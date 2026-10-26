function generateLetter(token, payload) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'letters.create');
    payload = cleanObject_(payload || {});
    assertRequired_(payload, ['TanggalSurat','KodeUnit','KodeJenis','TujuanSurat']);

    const unit = findBy_(APP.SHEETS.UNITS, 'KodeUnit', payload.KodeUnit, true);
    if (!unit || upper_(unit.Status) !== 'ACTIVE') throw new Error('Unit/divisi tidak valid.');
    const type = findBy_(APP.SHEETS.LETTER_TYPES, 'KodeJenis', payload.KodeJenis, true);
    if (!type || upper_(type.Status) !== 'ACTIVE') throw new Error('Jenis surat tidak valid.');

    const date = new Date(payload.TanggalSurat);
    if (isNaN(date)) throw new Error('Tanggal surat tidak valid.');
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const roman = monthRoman_(month);

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const letters = rows_(APP.SHEETS.LETTERS);
      const sameYear = letters.filter(r => Number(r.Tahun) === year);
      const next = sameYear.reduce((max, r) => Math.max(max, Number(r.NomorUrut) || 0), 0) + 1;
      const seq = String(next).padStart(3,'0');
      const number = `${seq}/${upper_(unit.KodeUnit)}/${upper_(type.KodeJenis)}/${roman}/${year}`;
      if (findBy_(APP.SHEETS.LETTERS, 'NomorSurat', number, true)) throw new Error('Nomor surat sudah ada. Silakan ulangi.');

      const row = {
        LetterID: uuid_(APP.ID_PREFIX.LETTERS),
        NomorSurat: number,
        NomorUrut: next,
        TanggalSurat: date,
        KodeUnit: upper_(unit.KodeUnit),
        JenisSurat: type.NamaJenis,
        KodeJenis: upper_(type.KodeJenis),
        TujuanSurat: payload.TujuanSurat,
        Bulan: month,
        BulanRomawi: roman,
        Tahun: year,
        Perihal: payload.Perihal || '',
        CreatedBy: s.user.Username,
        CreatedAt: now_(),
        UpdatedAt: now_()
      };
      append_(APP.SHEETS.LETTERS, row);
      audit_(s, 'GENERATE_LETTER_NUMBER', 'LETTERS', row.LetterID, number);
      return ok_(publicRow_(row), 'Nomor surat berhasil dibuat.');
    } finally {
      lock.releaseLock();
    }
  } catch (e) { return fail_(e.message); }
}

function listLetters(token, query) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'letters.view');
    query = query || {};
    let data = rows_(APP.SHEETS.LETTERS);
    if (query.search) {
      const q = lower_(query.search);
      data = data.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    }
    if (query.year) data = data.filter(r => String(r.Tahun) === String(query.year));
    if (query.unit) data = data.filter(r => upper_(r.KodeUnit) === upper_(query.unit));
    if (query.type) data = data.filter(r => upper_(r.KodeJenis) === upper_(query.type));
    const sortBy = query.sortBy || 'TanggalSurat';
    data.sort((a,b) => compareValues_(a[sortBy], b[sortBy], query.sortDir || 'desc'));
    return ok_(paginate_(data.map(publicRow_), query));
  } catch (e) { return fail_(e.message); }
}

function updateLetter(token, letterId, patch) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'letters.update');
    const current = findBy_(APP.SHEETS.LETTERS, 'LetterID', letterId);
    if (!current) throw new Error('Surat tidak ditemukan.');
    const safe = {};
    ['TujuanSurat','Perihal'].forEach(k => { if (patch[k] !== undefined) safe[k] = normalize_(patch[k]); });
    safe.UpdatedAt = now_();
    const updated = updateById_(APP.SHEETS.LETTERS, 'LetterID', letterId, safe);
    audit_(s, 'UPDATE_LETTER', 'LETTERS', letterId, 'Data surat diperbarui');
    return ok_(publicRow_(updated), 'Data surat berhasil diperbarui.');
  } catch (e) { return fail_(e.message); }
}
