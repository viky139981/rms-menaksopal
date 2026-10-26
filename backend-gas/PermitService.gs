function listPermits(token, query) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'permits.view');

    query = query || {};

    let data =
      rows_(APP.SHEETS.DC_PERMITS);

    if (query.search) {
      const q = lower_(query.search);

      data = data.filter(row =>
        JSON.stringify(row)
          .toLowerCase()
          .includes(q)
      );
    }

    if (query.status) {
      data = data.filter(row =>
        upper_(row.Status) ===
        upper_(query.status)
      );
    }

    data.sort(
      (a, b) =>
        new Date(b.TanggalPengajuan) -
        new Date(a.TanggalPengajuan)
    );

    return ok_(
      paginate_(
        data.map(publicRow_),
        query
      )
    );

  } catch (e) {
    return fail_(e.message);
  }
}


function createPermit(token, payload) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'permits.create');

    payload = cleanObject_(payload || {});

    assertRequired_(
      payload,
      [
        'Nama',
        'NIK',
        'Instansi',
        'Alamat',
        'SiteTujuan',
        'Tujuan',
        'TanggalMasuk',
        'JamMasuk'
      ]
    );

    if (!isValidNIK_(payload.NIK)) {
      throw new Error(
        'NIK harus 16 digit.'
      );
    }

    const site = findBy_(
      APP.SHEETS.SITES,
      'KodeSite',
      payload.SiteTujuan,
      true
    );

    if (
      !site ||
      upper_(site.TipeSite) !== 'DATA CENTER' ||
      upper_(site.Status) !== 'ACTIVE'
    ) {
      throw new Error(
        'Site tujuan harus Data Center aktif.'
      );
    }

    const row = {
      PermitID:
        uuid_(APP.ID_PREFIX.DC_PERMITS),

      TanggalPengajuan:
        now_(),

      Nama:
        payload.Nama,

      NIK:
        payload.NIK,

      Instansi:
        payload.Instansi,

      Divisi:
        payload.Divisi || '',

      Alamat:
        payload.Alamat,

      SiteTujuan:
        upper_(payload.SiteTujuan),

      Tujuan:
        payload.Tujuan,

      TanggalMasuk:
        payload.TanggalMasuk,

      JamMasuk:
        payload.JamMasuk,

      JamSelesai:
        '',

      Status:
        upper_(payload.Status || 'PENDING'),

      Approver:
        '',

      ApprovalNote:
        '',

      ApprovedAt:
        '',

      CreatedBy:
        s.user.Username,

      CreatedAt:
        now_(),

      UpdatedAt:
        now_()
    };

    if (
      ![
        'DRAFT',
        'PENDING'
      ].includes(row.Status)
    ) {
      row.Status = 'PENDING';
    }

    append_(
      APP.SHEETS.DC_PERMITS,
      row
    );

    audit_(
      s,
      'CREATE_DC_PERMIT',
      'DC_PERMITS',
      row.PermitID,
      row.Nama
    );

    return ok_(
      publicRow_(row),
      'Pengajuan izin berhasil dibuat.'
    );

  } catch (e) {
    return fail_(e.message);
  }
}


function decidePermit(
  token,
  permitId,
  decision,
  note
) {
  try {
    const s = getSession_(token, true);

    decision =
      upper_(decision);

    requirePermission_(
      s,
      decision === 'APPROVED'
        ? 'permits.approve'
        : 'permits.reject'
    );

    if (
      ![
        'APPROVED',
        'REJECTED'
      ].includes(decision)
    ) {
      throw new Error(
        'Keputusan tidak valid.'
      );
    }

    const permit = findBy_(
      APP.SHEETS.DC_PERMITS,
      'PermitID',
      permitId
    );

    if (!permit) {
      throw new Error(
        'Permit tidak ditemukan.'
      );
    }

    if (
      upper_(permit.Status) !==
      'PENDING'
    ) {
      throw new Error(
        'Hanya permit PENDING yang dapat diproses.'
      );
    }

    const updated = updateById_(
      APP.SHEETS.DC_PERMITS,
      'PermitID',
      permitId,
      {
        Status: decision,
        Approver: s.user.Username,
        ApprovalNote:
          normalize_(note),
        ApprovedAt: now_(),
        UpdatedAt: now_()
      }
    );

    audit_(
      s,
      decision === 'APPROVED'
        ? 'APPROVE_DC_PERMIT'
        : 'REJECT_DC_PERMIT',
      'DC_PERMITS',
      permitId,
      normalize_(note)
    );

    return ok_(
      publicRow_(updated),
      `Permit ${decision}.`
    );

  } catch (e) {
    return fail_(e.message);
  }
}


function completePermit(token, permitId) {
  try {
    const s = getSession_(token, true);

    requirePermission_(
      s,
      'permits.create'
    );

    const permit = findBy_(
      APP.SHEETS.DC_PERMITS,
      'PermitID',
      permitId
    );

    if (!permit) {
      throw new Error(
        'Permit tidak ditemukan.'
      );
    }

    if (
      upper_(permit.Status) !==
      'APPROVED'
    ) {
      throw new Error(
        'Hanya permit APPROVED yang dapat diselesaikan.'
      );
    }

    const jamKeluar =
      Utilities.formatDate(
        new Date(),
        APP.TIMEZONE,
        'HH:mm'
      );

    const updated = updateById_(
      APP.SHEETS.DC_PERMITS,
      'PermitID',
      permitId,
      {
        Status: 'COMPLETED',
        JamSelesai: jamKeluar,
        UpdatedAt: now_()
      }
    );

    audit_(
      s,
      'COMPLETE_DC_PERMIT',
      'DC_PERMITS',
      permitId,
      'Pekerjaan selesai'
    );

    return ok_(
      publicRow_(updated),
      'Permit diselesaikan.'
    );

  } catch (e) {
    return fail_(e.message);
  }
}
