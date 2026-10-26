/**
 * SiteService.gs
 * Site & Data Center grouped by NamaKota.
 * Backward compatible: automatically creates NamaKota column if missing.
 */

function ensureSiteCityColumn_() {
  const sh = getSheet_(APP.SHEETS.SITES);
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  if (!headers.includes('NamaKota')) {
    sh.getRange(1, lastCol + 1).setValue('NamaKota');
    SpreadsheetApp.flush();
  }
}


function listSites(token, query) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'sites.view');

    ensureSiteCityColumn_();

    query = query || {};

    let data = rows_(APP.SHEETS.SITES)
      .filter(x => !truthy_(x.IsDeleted));

    if (query.search) {
      const q = lower_(query.search);

      data = data.filter(r =>
        JSON.stringify(r)
          .toLowerCase()
          .includes(q)
      );
    }

    if (query.city) {
      data = data.filter(r =>
        upper_(r.NamaKota) === upper_(query.city)
      );
    }

    if (query.type) {
      data = data.filter(r =>
        upper_(r.TipeSite) === upper_(query.type)
      );
    }

    if (query.status) {
      data = data.filter(r =>
        upper_(r.Status) === upper_(query.status)
      );
    }

    data.sort((a, b) => {
      const cityCompare = String(a.NamaKota || '')
        .localeCompare(
          String(b.NamaKota || ''),
          'id',
          { sensitivity: 'base' }
        );

      if (cityCompare !== 0) return cityCompare;

      return String(a.KodeSite || '')
        .localeCompare(
          String(b.KodeSite || ''),
          'id',
          { sensitivity: 'base' }
        );
    });

    return ok_(
      paginate_(
        data.map(publicRow_),
        query
      )
    );

  } catch (e) {
    console.error('listSites:', e);
    return fail_(e.message);
  }
}


function saveSite(token, payload) {
  try {
    const s = getSession_(token, true);

    ensureSiteCityColumn_();

    payload = cleanObject_(payload || {});

    const isEdit = !!payload.SiteID;

    requirePermission_(
      s,
      isEdit
        ? 'sites.update'
        : 'sites.create'
    );

    assertRequired_(
      payload,
      [
        'KodeSite',
        'NamaSite',
        'NamaKota',
        'TipeSite',
        'Status'
      ]
    );

    const kodeSite = upper_(payload.KodeSite);
    const namaKota = normalize_(payload.NamaKota);

    if (!namaKota) {
      throw new Error('Nama Kota wajib diisi.');
    }

    const dup = rows_(APP.SHEETS.SITES)
      .find(r =>
        !truthy_(r.IsDeleted) &&
        upper_(r.KodeSite) === kodeSite &&
        String(r.SiteID) !== String(payload.SiteID || '')
      );

    if (dup) {
      throw new Error('Kode Site sudah digunakan.');
    }

    const data = {
      KodeSite: kodeSite,
      NamaSite: normalize_(payload.NamaSite),
      NamaKota: namaKota,
      TipeSite: normalize_(payload.TipeSite),
      PICKoordinator: normalize_(payload.PICKoordinator || ''),
      Alamat: normalize_(payload.Alamat || ''),
      Status: upper_(payload.Status || 'ACTIVE'),
      Keterangan: normalize_(payload.Keterangan || ''),
      IsDeleted: false,
      UpdatedAt: now_()
    };

    if (isEdit) {
      const x = updateById_(
        APP.SHEETS.SITES,
        'SiteID',
        payload.SiteID,
        data
      );

      audit_(
        s,
        'UPDATE_SITE',
        'SITES',
        payload.SiteID,
        `${kodeSite} | Kota: ${namaKota}`
      );

      return ok_(
        publicRow_(x),
        'Site berhasil diperbarui.'
      );
    }

    data.SiteID = uuid_(APP.ID_PREFIX.SITES);
    data.CreatedBy = s.user.Username;
    data.CreatedAt = now_();

    append_(APP.SHEETS.SITES, data);

    audit_(
      s,
      'CREATE_SITE',
      'SITES',
      data.SiteID,
      `${kodeSite} | Kota: ${namaKota}`
    );

    return ok_(
      publicRow_(data),
      'Site berhasil ditambahkan.'
    );

  } catch (e) {
    console.error('saveSite:', e);
    return fail_(e.message);
  }
}


function deactivateSite(token, siteId) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'sites.deactivate');

    ensureSiteCityColumn_();

    const site = findBy_(
      APP.SHEETS.SITES,
      'SiteID',
      siteId,
      false
    );

    if (!site || truthy_(site.IsDeleted)) {
      throw new Error('Site tidak ditemukan.');
    }

    const siteCode = String(site.KodeSite || '');

    // Jaga integritas relasi master.
    const deviceCount = rows_(APP.SHEETS.DEVICES)
      .filter(x =>
        !truthy_(x.IsDeleted) &&
        String(x.SiteCode || '') === siteCode
      ).length;

    const rackCount = rows_(APP.SHEETS.RACKS)
      .filter(x =>
        !truthy_(x.IsDeleted) &&
        String(x.SiteCode || '') === siteCode
      ).length;

    if (deviceCount > 0 || rackCount > 0) {
      const parts = [];

      if (deviceCount > 0) {
        parts.push(`${deviceCount} device`);
      }

      if (rackCount > 0) {
        parts.push(`${rackCount} rack`);
      }

      throw new Error(
        `Site belum dapat dihapus karena masih memiliki ${parts.join(' dan ')}. ` +
        'Pindahkan/nonaktifkan data terkait terlebih dahulu.'
      );
    }

    updateById_(
      APP.SHEETS.SITES,
      'SiteID',
      siteId,
      {
        Status: 'INACTIVE',
        IsDeleted: true,
        UpdatedAt: now_()
      }
    );

    audit_(
      s,
      'DELETE_SITE',
      'SITES',
      siteId,
      `${siteCode} dinonaktifkan (soft delete)`
    );

    return ok_(
      null,
      'Site / Data Center berhasil dihapus.'
    );

  } catch (e) {
    console.error('deactivateSite:', e);
    return fail_(e.message);
  }
}
