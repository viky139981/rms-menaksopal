const DB_SCHEMA = Object.freeze({
  USERS: ['UserID','Username','PasswordHash','Salt','Nama','Email','Role','Divisi','Status','MustChangePassword','LastLogin','CreatedAt','UpdatedAt'],
  LETTERS: ['LetterID','NomorSurat','NomorUrut','TanggalSurat','KodeUnit','JenisSurat','KodeJenis','TujuanSurat','Bulan','BulanRomawi','Tahun','Perihal','CreatedBy','CreatedAt','UpdatedAt'],
  LETTER_TYPES: ['LetterTypeID','KodeJenis','NamaJenis','Status','CreatedAt','UpdatedAt'],
  UNITS: ['UnitID','KodeUnit','NamaUnit','Status','CreatedAt','UpdatedAt'],
  DEVICE_TYPES: ['DeviceTypeID','NamaJenis','Status','CreatedAt','UpdatedAt'],
  DEVICES: ['DeviceID','NamaDevice','Brand','JenisDevice','TipeDevice','SerialNumber','IPAddress','SiteCode','RackCode','RackUnit','Port','LokasiDevice','StatusDevice','Kondisi','Keterangan','IsDeleted','CreatedBy','CreatedAt','UpdatedAt'],
  SITES: ['SiteID','KodeSite','NamaSite','NamaKota','TipeSite','PICKoordinator','Alamat','Status','Keterangan','IsDeleted','CreatedBy','CreatedAt','UpdatedAt'],
  RACKS: ['RackID','KodeRack','SiteCode','LokasiRack','JumlahRackUnit','Status','Keterangan','IsDeleted','CreatedAt','UpdatedAt'],
  DC_PERMITS: ['PermitID','TanggalPengajuan','Nama','NIK','Instansi','Divisi','Alamat','SiteTujuan','Tujuan','TanggalMasuk','JamMasuk','JamSelesai','Status','Approver','ApprovalNote','ApprovedAt','CreatedBy','CreatedAt','UpdatedAt'],
  DEVICE_IN: ['TransactionID','TanggalMasuk','DeviceID','NamaDevice','Brand','JenisDevice','Tipe','SerialNumber','KelengkapanDevice','SiteTujuan','RackTujuan','RackUnit','Kondisi','Keterangan','DibawaOleh','Status','CreatedBy','CreatedAt'],
  DEVICE_OUT: ['TransactionID','TanggalKeluar','DeviceID','NamaDevice','Brand','JenisDevice','Tipe','SerialNumber','KelengkapanDevice','SiteAsal','RackAsal','TujuanKeluar','DibawaOleh','Keterangan','Status','CreatedBy','CreatedAt'],
  DEVICE_MOVEMENTS: ['MovementID','DeviceID','MovementType','FromSite','FromRack','ToSite','ToRack','Tanggal','ReferenceID','Keterangan','CreatedBy','CreatedAt'],
  AUDIT_LOG: ['LogID','Timestamp','UserID','Username','Action','Module','ReferenceID','Description'],
  SETTINGS: ['Key','Value','Description','UpdatedAt'],
  TICKETS: ['TicketID','TicketNumber','ReportedAt','Title','Category','Severity','City','SiteCode','DeviceID','DeviceName','AffectedService','Description','Impact','IncidentStart','Status','AssignedTo','ActionTaken','RootCause','ResolvedAt','ClosedAt','DurationMinutes','IsDeleted','CreatedBy','CreatedAt','UpdatedAt'],
  TICKET_UPDATES: ['UpdateID','TicketID','Timestamp','Status','ActionTaken','RootCause','Note','UpdatedBy']
});

function getDb_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }

  throw new Error(
    'SPREADSHEET_ID belum dikonfigurasi. Jalankan setupApplication() dari Apps Script yang terikat pada Spreadsheet atau set Script Property SPREADSHEET_ID.'
  );
}

function getSheet_(name) {
  const ss = getDb_();
  const sh = ss.getSheetByName(name);

  if (!sh) {
    throw new Error(
      `Sheet ${name} tidak ditemukan. Jalankan setupApplication().`
    );
  }

  return sh;
}

function ensureSheet_(name, headers) {
  const ss = getDb_();
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    const current = sh
      .getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length))
      .getValues()[0];

    const missing = headers.filter(h => !current.includes(h));

    if (missing.length) {
      sh.getRange(
        1,
        current.filter(Boolean).length + 1,
        1,
        missing.length
      ).setValues([missing]);
    }
  }

  return sh;
}

function rows_(sheetName) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values.shift().map(String);

  return values.map((row, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function append_(sheetName, object) {
  const sh = getSheet_(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = headers.map(h =>
    object[h] !== undefined ? object[h] : ''
  );

  sh.appendRow(row);
  return object;
}

function updateById_(sheetName, idField, idValue, patch) {
  const sh = getSheet_(sheetName);
  const data = sh.getDataRange().getValues();

  if (data.length < 2) {
    throw new Error('Data tidak ditemukan.');
  }

  const headers = data[0].map(String);
  const idCol = headers.indexOf(idField);

  if (idCol < 0) {
    throw new Error(`Kolom ${idField} tidak ditemukan.`);
  }

  const rowIndex = data.findIndex((row, idx) =>
    idx > 0 &&
    String(row[idCol]) === String(idValue)
  );

  if (rowIndex < 1) {
    throw new Error('Data tidak ditemukan.');
  }

  const current = {};
  headers.forEach((h, i) => current[h] = data[rowIndex][i]);

  const merged = Object.assign({}, current, patch);

  sh.getRange(
    rowIndex + 1,
    1,
    1,
    headers.length
  ).setValues([
    headers.map(h =>
      merged[h] !== undefined ? merged[h] : ''
    )
  ]);

  return merged;
}

function findBy_(sheetName, field, value, caseInsensitive) {
  const target = caseInsensitive
    ? lower_(value)
    : String(value);

  return rows_(sheetName).find(r => {
    const v = caseInsensitive
      ? lower_(r[field])
      : String(r[field]);

    return v === target;
  }) || null;
}

function listMaster_(sheetName, statusField) {
  return rows_(sheetName).filter(r =>
    !statusField ||
    upper_(r[statusField]) === 'ACTIVE'
  );
}

function getSetting_(key, fallback) {
  const row = findBy_(
    APP.SHEETS.SETTINGS,
    'Key',
    key,
    true
  );

  return row ? row.Value : fallback;
}

function setSetting_(key, value, description) {
  const existing = findBy_(
    APP.SHEETS.SETTINGS,
    'Key',
    key,
    true
  );

  if (existing) {
    return updateById_(
      APP.SHEETS.SETTINGS,
      'Key',
      existing.Key,
      {
        Value: value,
        Description: description || existing.Description,
        UpdatedAt: now_()
      }
    );
  }

  return append_(
    APP.SHEETS.SETTINGS,
    {
      Key: key,
      Value: value,
      Description: description || '',
      UpdatedAt: now_()
    }
  );
}
