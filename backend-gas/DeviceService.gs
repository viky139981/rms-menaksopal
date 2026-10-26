function listDevices(token, query) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'devices.view');

    query = query || {};

    const sites = rows_(APP.SHEETS.SITES)
      .filter(x => !truthy_(x.IsDeleted));

    const siteMap = {};
    sites.forEach(site => {
      siteMap[String(site.KodeSite || '')] = site;
    });

    let data = rows_(APP.SHEETS.DEVICES)
      .filter(x => !truthy_(x.IsDeleted));

    if (query.scope) {
      const scope = upper_(query.scope);

      data = data.filter(device => {
        const site = siteMap[String(device.SiteCode || '')];
        const type = upper_(site && site.TipeSite);

        if (scope === 'DC') {
          return type === 'DATA CENTER';
        }

        if (scope === 'SITE') {
          return type !== 'DATA CENTER';
        }

        return true;
      });
    }

    if (query.search) {
      const q = lower_(query.search);
      data = data.filter(row =>
        JSON.stringify(row).toLowerCase().includes(q)
      );
    }

    if (query.site) {
      data = data.filter(row =>
        upper_(row.SiteCode) === upper_(query.site)
      );
    }

    if (query.status) {
      data = data.filter(row =>
        upper_(row.StatusDevice) === upper_(query.status)
      );
    }

    if (query.type) {
      data = data.filter(row =>
        upper_(row.JenisDevice) === upper_(query.type)
      );
    }

    const sortBy = query.sortBy || 'NamaDevice';

    data.sort((a, b) =>
      compareValues_(
        a[sortBy],
        b[sortBy],
        query.sortDir || 'asc'
      )
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


function saveDevice(token, payload) {
  try {
    const s = getSession_(token, true);

    payload = cleanObject_(payload || {});

    const isEdit = !!payload.DeviceID;

    requirePermission_(
      s,
      isEdit
        ? 'devices.update'
        : 'devices.create'
    );

    assertRequired_(
      payload,
      [
        'NamaDevice',
        'Brand',
        'JenisDevice',
        'TipeDevice',
        'StatusDevice'
      ]
    );

    if (
      payload.IPAddress &&
      !isValidIPv4_(payload.IPAddress)
    ) {
      throw new Error(
        'Format IP Address tidak valid.'
      );
    }

    if (payload.SerialNumber) {
      const duplicate = rows_(APP.SHEETS.DEVICES)
        .find(row =>
          !truthy_(row.IsDeleted) &&
          lower_(row.SerialNumber) ===
            lower_(payload.SerialNumber) &&
          String(row.DeviceID) !==
            String(payload.DeviceID || '')
        );

      if (duplicate) {
        throw new Error(
          'Serial Number sudah terdaftar.'
        );
      }
    }

    if (payload.SiteCode) {
      const site = rows_(APP.SHEETS.SITES)
        .find(row =>
          !truthy_(row.IsDeleted) &&
          upper_(row.KodeSite) ===
            upper_(payload.SiteCode)
        );

      if (!site) {
        throw new Error(
          'Site yang dipilih tidak ditemukan.'
        );
      }

      const requestedScope =
        upper_(payload.DeviceScope);

      const siteType =
        upper_(site.TipeSite);

      if (
        requestedScope === 'DC' &&
        siteType !== 'DATA CENTER'
      ) {
        throw new Error(
          'Device Data Center hanya dapat ditempatkan pada Site tipe Data Center.'
        );
      }

      if (
        requestedScope === 'SITE' &&
        siteType === 'DATA CENTER'
      ) {
        throw new Error(
          'Device Site / POP tidak dapat ditempatkan pada Data Center.'
        );
      }
    }

    const data = {
      NamaDevice: payload.NamaDevice,
      Brand: payload.Brand,
      JenisDevice: payload.JenisDevice,
      TipeDevice: payload.TipeDevice,
      SerialNumber: payload.SerialNumber || '',
      IPAddress: payload.IPAddress || '',
      SiteCode: upper_(payload.SiteCode || ''),
      RackCode: upper_(payload.RackCode || ''),
      RackUnit: payload.RackUnit || '',
      Port: payload.Port || '',
      LokasiDevice: payload.LokasiDevice || '',
      StatusDevice: upper_(payload.StatusDevice || 'ACTIVE'),
      Kondisi: payload.Kondisi || '',
      Keterangan: payload.Keterangan || '',
      IsDeleted: false,
      UpdatedAt: now_()
    };

    if (isEdit) {
      const before = findBy_(
        APP.SHEETS.DEVICES,
        'DeviceID',
        payload.DeviceID
      );

      if (!before) {
        throw new Error(
          'Device tidak ditemukan.'
        );
      }

      const updated = updateById_(
        APP.SHEETS.DEVICES,
        'DeviceID',
        payload.DeviceID,
        data
      );

      if (
        String(before.SiteCode) !==
          String(data.SiteCode) ||
        String(before.RackCode) !==
          String(data.RackCode)
      ) {
        recordMovement_(
          s,
          {
            DeviceID: payload.DeviceID,
            MovementType: 'MOVE',
            FromSite: before.SiteCode,
            FromRack: before.RackCode,
            ToSite: data.SiteCode,
            ToRack: data.RackCode,
            Tanggal: now_(),
            ReferenceID: payload.DeviceID,
            Keterangan:
              'Perubahan lokasi melalui edit device'
          }
        );
      }

      audit_(
        s,
        'UPDATE_DEVICE',
        'DEVICES',
        payload.DeviceID,
        payload.NamaDevice
      );

      return ok_(
        publicRow_(updated),
        'Device berhasil diperbarui.'
      );
    }

    data.DeviceID =
      uuid_(APP.ID_PREFIX.DEVICES);

    data.CreatedBy =
      s.user.Username;

    data.CreatedAt =
      now_();

    append_(
      APP.SHEETS.DEVICES,
      data
    );

    audit_(
      s,
      'CREATE_DEVICE',
      'DEVICES',
      data.DeviceID,
      data.NamaDevice
    );

    return ok_(
      publicRow_(data),
      'Device berhasil ditambahkan.'
    );

  } catch (e) {
    return fail_(e.message);
  }
}


function deactivateDevice(token, deviceId) {
  try {
    const s = getSession_(token, true);

    requirePermission_(
      s,
      'devices.deactivate'
    );

    updateById_(
      APP.SHEETS.DEVICES,
      'DeviceID',
      deviceId,
      {
        StatusDevice: 'DECOMMISSIONED',
        IsDeleted: true,
        UpdatedAt: now_()
      }
    );

    audit_(
      s,
      'DEACTIVATE_DEVICE',
      'DEVICES',
      deviceId,
      'Device dinonaktifkan'
    );

    return ok_(
      null,
      'Device berhasil dinonaktifkan.'
    );

  } catch (e) {
    return fail_(e.message);
  }
}


function getDeviceHistory(token, deviceId) {
  try {
    const s = getSession_(token, true);

    requirePermission_(
      s,
      'movements.view'
    );

    const data =
      rows_(APP.SHEETS.DEVICE_MOVEMENTS)
        .filter(row =>
          String(row.DeviceID) ===
          String(deviceId)
        )
        .sort(
          (a, b) =>
            new Date(b.Tanggal) -
            new Date(a.Tanggal)
        );

    return ok_(
      data.map(publicRow_)
    );

  } catch (e) {
    return fail_(e.message);
  }
}
