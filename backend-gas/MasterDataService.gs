function getMasterData(token) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'master.view');
    const sites = rows_(APP.SHEETS.SITES).filter(x => !truthy_(x.IsDeleted) && upper_(x.Status) === 'ACTIVE').map(publicRow_);
    const racks = rows_(APP.SHEETS.RACKS).filter(x => !truthy_(x.IsDeleted) && upper_(x.Status) === 'ACTIVE').map(publicRow_);
    return ok_({
      letterTypes: listMaster_(APP.SHEETS.LETTER_TYPES, 'Status').map(publicRow_),
      units: listMaster_(APP.SHEETS.UNITS, 'Status').map(publicRow_),
      deviceTypes: listMaster_(APP.SHEETS.DEVICE_TYPES, 'Status').map(publicRow_),
      sites: sites,
      racks: racks
    });
  } catch (e) { return fail_(e.message); }
}

function saveMasterItem(token, type, payload) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'master.manage');
    type = upper_(type);
    payload = cleanObject_(payload || {});
    if (type === 'LETTER_TYPE') {
      assertRequired_(payload, ['KodeJenis','NamaJenis']);
      const existing = findBy_(APP.SHEETS.LETTER_TYPES, 'KodeJenis', payload.KodeJenis, true);
      if (existing) {
        const x = updateById_(APP.SHEETS.LETTER_TYPES, 'LetterTypeID', existing.LetterTypeID, {
          NamaJenis: payload.NamaJenis, Status: payload.Status || 'ACTIVE', UpdatedAt: now_()
        });
        return ok_(publicRow_(x), 'Jenis surat diperbarui.');
      }
      const x = { LetterTypeID: uuid_(APP.ID_PREFIX.LETTER_TYPES), KodeJenis: upper_(payload.KodeJenis), NamaJenis: payload.NamaJenis, Status: payload.Status || 'ACTIVE', CreatedAt: now_(), UpdatedAt: now_() };
      append_(APP.SHEETS.LETTER_TYPES, x); return ok_(publicRow_(x), 'Jenis surat ditambahkan.');
    }
    if (type === 'UNIT') {
      assertRequired_(payload, ['KodeUnit','NamaUnit']);
      const existing = findBy_(APP.SHEETS.UNITS, 'KodeUnit', payload.KodeUnit, true);
      if (existing) {
        const x = updateById_(APP.SHEETS.UNITS, 'UnitID', existing.UnitID, { NamaUnit: payload.NamaUnit, Status: payload.Status || 'ACTIVE', UpdatedAt: now_() });
        return ok_(publicRow_(x), 'Unit diperbarui.');
      }
      const x = { UnitID: uuid_(APP.ID_PREFIX.UNITS), KodeUnit: upper_(payload.KodeUnit), NamaUnit: payload.NamaUnit, Status: payload.Status || 'ACTIVE', CreatedAt: now_(), UpdatedAt: now_() };
      append_(APP.SHEETS.UNITS, x); return ok_(publicRow_(x), 'Unit ditambahkan.');
    }
    if (type === 'DEVICE_TYPE') {
      assertRequired_(payload, ['NamaJenis']);
      const existing = findBy_(APP.SHEETS.DEVICE_TYPES, 'NamaJenis', payload.NamaJenis, true);
      if (existing) {
        const x = updateById_(APP.SHEETS.DEVICE_TYPES, 'DeviceTypeID', existing.DeviceTypeID, { Status: payload.Status || 'ACTIVE', UpdatedAt: now_() });
        return ok_(publicRow_(x), 'Jenis device diperbarui.');
      }
      const x = { DeviceTypeID: uuid_(APP.ID_PREFIX.DEVICE_TYPES), NamaJenis: payload.NamaJenis, Status: payload.Status || 'ACTIVE', CreatedAt: now_(), UpdatedAt: now_() };
      append_(APP.SHEETS.DEVICE_TYPES, x); return ok_(publicRow_(x), 'Jenis device ditambahkan.');
    }
    throw new Error('Tipe master tidak dikenal.');
  } catch (e) { return fail_(e.message); }
}
