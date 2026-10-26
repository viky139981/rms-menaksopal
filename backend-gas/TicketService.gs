/**
 * TicketService.gs — V7.1 FIX
 * Robust incident / trouble ticket storage for MLN Management System.
 *
 * Fixes:
 * - Ticket save is the primary transaction.
 * - Failure in update-history or audit does NOT invalidate a saved ticket.
 * - Direct sheet read/write helpers reduce dependency on generic CRUD wrappers.
 * - Return values are sanitized into plain serializable objects.
 * - Error messages are explicit for frontend troubleshooting.
 */

const MLN_TICKET_SHEET = 'TICKETS';
const MLN_TICKET_UPDATE_SHEET = 'TICKET_UPDATES';

const MLN_TICKET_HEADERS = [
  'TicketID',
  'TicketNumber',
  'ReportedAt',
  'Title',
  'Category',
  'Severity',
  'City',
  'SiteCode',
  'DeviceID',
  'DeviceName',
  'AffectedService',
  'Description',
  'Impact',
  'IncidentStart',
  'Status',
  'AssignedTo',
  'ActionTaken',
  'RootCause',
  'ResolvedAt',
  'ClosedAt',
  'DurationMinutes',
  'IsDeleted',
  'CreatedBy',
  'CreatedAt',
  'UpdatedAt'
];

const MLN_TICKET_UPDATE_HEADERS = [
  'UpdateID',
  'TicketID',
  'Timestamp',
  'Status',
  'ActionTaken',
  'RootCause',
  'Note',
  'UpdatedBy'
];

const MLN_TICKET_STATUSES = [
  'OPEN',
  'IN PROGRESS',
  'MONITORING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED'
];

const MLN_TICKET_SEVERITIES = [
  'P1 - CRITICAL',
  'P2 - HIGH',
  'P3 - MEDIUM',
  'P4 - LOW'
];

const MLN_TICKET_CATEGORIES = [
  'Fiber Cut',
  'Link Down',
  'High Latency',
  'Packet Loss',
  'BGP Down',
  'Power Failure',
  'Device Down',
  'Device Restart / Reboot',
  'OLT Down',
  'PPPoE / Authentication',
  'Routing Problem',
  'DNS Problem',
  'Bandwidth / Congestion',
  'Data Center',
  'Upstream Provider',
  'Maintenance Impact',
  'Customer / Corporate Link',
  'Other'
];


function ensureTicketSheets_() {
  const ss = getDb_();

  let ticketSheet =
    ss.getSheetByName(MLN_TICKET_SHEET);

  if (!ticketSheet) {
    ticketSheet =
      ss.insertSheet(MLN_TICKET_SHEET);

    ticketSheet
      .getRange(
        1,
        1,
        1,
        MLN_TICKET_HEADERS.length
      )
      .setValues([MLN_TICKET_HEADERS]);

    ticketSheet.setFrozenRows(1);

    ticketSheet
      .getRange(
        1,
        1,
        1,
        MLN_TICKET_HEADERS.length
      )
      .setFontWeight('bold');
  } else {
    ensureTicketHeaders_(
      ticketSheet,
      MLN_TICKET_HEADERS
    );
  }

  let updateSheet =
    ss.getSheetByName(
      MLN_TICKET_UPDATE_SHEET
    );

  if (!updateSheet) {
    updateSheet =
      ss.insertSheet(
        MLN_TICKET_UPDATE_SHEET
      );

    updateSheet
      .getRange(
        1,
        1,
        1,
        MLN_TICKET_UPDATE_HEADERS.length
      )
      .setValues([
        MLN_TICKET_UPDATE_HEADERS
      ]);

    updateSheet.setFrozenRows(1);

    updateSheet
      .getRange(
        1,
        1,
        1,
        MLN_TICKET_UPDATE_HEADERS.length
      )
      .setFontWeight('bold');
  } else {
    ensureTicketHeaders_(
      updateSheet,
      MLN_TICKET_UPDATE_HEADERS
    );
  }

  return {
    ticketSheet,
    updateSheet
  };
}


function ensureTicketHeaders_(
  sheet,
  requiredHeaders
) {
  const lastCol =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const current =
    sheet
      .getRange(
        1,
        1,
        1,
        lastCol
      )
      .getValues()[0]
      .map(String);

  const missing =
    requiredHeaders.filter(
      header =>
        !current.includes(header)
    );

  if (!missing.length) return;

  const startCol =
    current.filter(Boolean).length + 1;

  sheet
    .getRange(
      1,
      startCol,
      1,
      missing.length
    )
    .setValues([missing]);

  SpreadsheetApp.flush();
}


function ticketString_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


function ticketUpper_(value) {
  return ticketString_(value)
    .toUpperCase();
}


function ticketTruthy_(value) {
  if (value === true) return true;

  const v =
    ticketUpper_(value);

  return [
    'TRUE',
    '1',
    'YES',
    'Y'
  ].includes(v);
}


function requireTicketView_(session) {
  requirePermission_(session, 'tickets.view');
}

function requireTicketManage_(session) {
  requirePermission_(session, 'tickets.manage');
}

function requireTicketDelete_(session) {
  requirePermission_(session, 'tickets.delete');
}


function ticketReadSheet_(sheetName) {
  const ss = getDb_();
  const sh = ss.getSheetByName(sheetName);

  if (!sh) return [];

  const lastRow =
    sh.getLastRow();

  const lastCol =
    sh.getLastColumn();

  if (
    lastRow < 2 ||
    lastCol < 1
  ) {
    return [];
  }

  const values =
    sh.getRange(
      1,
      1,
      lastRow,
      lastCol
    ).getValues();

  const headers =
    values.shift().map(String);

  return values.map(
    (row, index) => {
      const obj = {
        _row:index + 2
      };

      headers.forEach(
        (header, col) => {
          obj[header] =
            row[col];
        }
      );

      return obj;
    }
  );
}


function ticketAppendRow_(
  sheetName,
  data
) {
  const ss = getDb_();
  const sh =
    ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error(
      `Sheet ${sheetName} tidak ditemukan.`
    );
  }

  const lastCol =
    sh.getLastColumn();

  const headers =
    sh
      .getRange(
        1,
        1,
        1,
        lastCol
      )
      .getValues()[0]
      .map(String);

  const row =
    headers.map(
      header =>
        Object.prototype.hasOwnProperty.call(
          data,
          header
        )
          ? data[header]
          : ''
    );

  sh.appendRow(row);
  SpreadsheetApp.flush();
}


function ticketUpdateRow_(
  ticketId,
  patch
) {
  const ss = getDb_();
  const sh =
    ss.getSheetByName(
      MLN_TICKET_SHEET
    );

  if (!sh) {
    throw new Error(
      'Sheet TICKETS tidak ditemukan.'
    );
  }

  const lastRow =
    sh.getLastRow();

  const lastCol =
    sh.getLastColumn();

  const values =
    sh.getRange(
      1,
      1,
      lastRow,
      lastCol
    ).getValues();

  const headers =
    values[0].map(String);

  const idCol =
    headers.indexOf(
      'TicketID'
    );

  if (idCol < 0) {
    throw new Error(
      'Kolom TicketID tidak ditemukan pada Sheet TICKETS.'
    );
  }

  let rowIndex = -1;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    if (
      String(values[i][idCol]) ===
      String(ticketId)
    ) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex < 2) {
    throw new Error(
      'Tiket gangguan tidak ditemukan.'
    );
  }

  const current =
    values[rowIndex - 1];

  const next =
    headers.map(
      (header, col) =>
        Object.prototype.hasOwnProperty.call(
          patch,
          header
        )
          ? patch[header]
          : current[col]
    );

  sh
    .getRange(
      rowIndex,
      1,
      1,
      headers.length
    )
    .setValues([next]);

  SpreadsheetApp.flush();

  const out = {};

  headers.forEach(
    (header, col) => {
      out[header] =
        next[col];
    }
  );

  return out;
}


function ticketPlainValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      'Asia/Jakarta',
      "yyyy-MM-dd'T'HH:mm:ss"
    );
  }

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return value;
}


function ticketPlainRow_(row) {
  if (!row) return row;

  const out = {};

  Object.keys(row).forEach(
    key => {
      if (key === '_row') return;

      out[key] =
        ticketPlainValue_(
          row[key]
        );
    }
  );

  return out;
}


function ticketNowLocal_() {
  return Utilities.formatDate(
    new Date(),
    'Asia/Jakarta',
    "yyyy-MM-dd'T'HH:mm"
  );
}


function ticketTimestamp_() {
  return Utilities.formatDate(
    new Date(),
    'Asia/Jakarta',
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function ticketTodayKey_() {
  return Utilities.formatDate(
    new Date(),
    'Asia/Jakarta',
    'yyyyMMdd'
  );
}


function ticketId_() {
  return (
    'TKT-' +
    Utilities
      .getUuid()
      .replace(/-/g, '')
      .substring(0, 10)
      .toUpperCase()
  );
}


function ticketUpdateId_() {
  return (
    'TUP-' +
    Utilities
      .getUuid()
      .replace(/-/g, '')
      .substring(0, 10)
      .toUpperCase()
  );
}


function generateTicketNumber_() {
  ensureTicketSheets_();

  const lock =
    LockService.getScriptLock();

  lock.waitLock(15000);

  try {
    const dayKey =
      ticketTodayKey_();

    const prefix =
      `INC-${dayKey}-`;

    const rows =
      ticketReadSheet_(
        MLN_TICKET_SHEET
      );

    let highest = 0;

    rows.forEach(
      row => {
        const number =
          ticketString_(
            row.TicketNumber
          );

        if (
          !number.startsWith(prefix)
        ) {
          return;
        }

        const sequence =
          parseInt(
            number.substring(
              prefix.length
            ),
            10
          );

        if (
          Number.isFinite(sequence) &&
          sequence > highest
        ) {
          highest = sequence;
        }
      }
    );

    return (
      prefix +
      String(highest + 1)
        .padStart(3, '0')
    );

  } finally {
    lock.releaseLock();
  }
}


function ticketDateMs_(value) {
  if (!value) return NaN;

  if (value instanceof Date) {
    return value.getTime();
  }

  const d =
    new Date(
      String(value).trim()
    );

  return d.getTime();
}


function calculateTicketDuration_(
  start,
  end
) {
  const startMs =
    ticketDateMs_(start);

  const endMs =
    ticketDateMs_(end);

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs < startMs
  ) {
    return '';
  }

  return Math.round(
    (endMs - startMs) /
    60000
  );
}


function safeTicketUpdateHistory_(
  ticket,
  status,
  actionTaken,
  rootCause,
  note,
  username
) {
  try {
    ticketAppendRow_(
      MLN_TICKET_UPDATE_SHEET,
      {
        UpdateID:
          ticketUpdateId_(),

        TicketID:
          ticket.TicketID,

        Timestamp:
          ticketTimestamp_(),

        Status:
          status ||
          ticket.Status ||
          '',

        ActionTaken:
          actionTaken || '',

        RootCause:
          rootCause || '',

        Note:
          note || '',

        UpdatedBy:
          username || ''
      }
    );

  } catch (e) {
    console.error(
      'TICKET HISTORY WARNING:',
      e &&
      e.stack
        ? e.stack
        : e
    );
  }
}


function safeTicketAudit_(
  session,
  action,
  referenceId,
  description
) {
  try {
    if (
      typeof audit_ ===
      'function'
    ) {
      audit_(
        session,
        action,
        'TICKETS',
        referenceId,
        description
      );
    }
  } catch (e) {
    console.error(
      'TICKET AUDIT WARNING:',
      e &&
      e.stack
        ? e.stack
        : e
    );
  }
}


function listIncidentTickets(
  token,
  query
) {
  try {
    const session =
      getSession_(token, true);

    requireTicketView_(session);
    ensureTicketSheets_();

    query = query || {};

    let rows =
      ticketReadSheet_(
        MLN_TICKET_SHEET
      )
      .filter(
        row =>
          !ticketTruthy_(
            row.IsDeleted
          )
      );

    const allRows =
      rows.slice();

    if (query.search) {
      const q =
        ticketString_(
          query.search
        ).toLowerCase();

      rows =
        rows.filter(
          row =>
            [
              row.TicketNumber,
              row.Title,
              row.Category,
              row.Severity,
              row.City,
              row.SiteCode,
              row.DeviceName,
              row.AffectedService,
              row.Description,
              row.Impact,
              row.AssignedTo,
              row.Status,
              row.RootCause
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(q)
        );
    }

    if (query.status) {
      rows =
        rows.filter(
          row =>
            ticketUpper_(
              row.Status
            ) ===
            ticketUpper_(
              query.status
            )
        );
    }

    if (query.severity) {
      rows =
        rows.filter(
          row =>
            ticketUpper_(
              row.Severity
            ) ===
            ticketUpper_(
              query.severity
            )
        );
    }

    rows.sort(
      (a, b) =>
        (
          ticketDateMs_(
            b.ReportedAt ||
            b.CreatedAt
          ) || 0
        ) -
        (
          ticketDateMs_(
            a.ReportedAt ||
            a.CreatedAt
          ) || 0
        )
    );

    const page =
      Math.max(
        parseInt(query.page || 1, 10),
        1
      );

    const pageSize =
      Math.max(
        Math.min(
          parseInt(
            query.pageSize || 20,
            10
          ),
          200
        ),
        1
      );

    const total =
      rows.length;

    const pages =
      Math.max(
        Math.ceil(
          total / pageSize
        ),
        1
      );

    const safePage =
      Math.min(page, pages);

    const start =
      (safePage - 1) *
      pageSize;

    const pageRows =
      rows
        .slice(
          start,
          start + pageSize
        )
        .map(ticketPlainRow_);

    const today =
      Utilities.formatDate(
        new Date(),
        'Asia/Jakarta',
        'yyyy-MM-dd'
      );

    return ok_({
      rows:pageRows,
      page:safePage,
      pageSize,
      total,
      totalPages:pages,
      stats:{
        open:
          allRows.filter(
            row =>
              ticketUpper_(
                row.Status
              ) === 'OPEN'
          ).length,

        inProgress:
          allRows.filter(
            row =>
              ticketUpper_(
                row.Status
              ) ===
              'IN PROGRESS'
          ).length,

        monitoring:
          allRows.filter(
            row =>
              ticketUpper_(
                row.Status
              ) ===
              'MONITORING'
          ).length,

        critical:
          allRows.filter(
            row =>
              ticketUpper_(
                row.Severity
              ) ===
              'P1 - CRITICAL' &&
              ![
                'RESOLVED',
                'CLOSED',
                'CANCELLED'
              ].includes(
                ticketUpper_(
                  row.Status
                )
              )
          ).length,

        resolvedToday:
          allRows.filter(
            row =>
              ticketString_(
                row.ResolvedAt
              ).substring(0,10) ===
              today
          ).length
      }
    });

  } catch (e) {
    console.error(
      'listIncidentTickets ERROR:',
      e &&
      e.stack
        ? e.stack
        : e
    );

    return fail_(
      'Gagal memuat tiket: ' +
      (
        e &&
        e.message
          ? e.message
          : String(e)
      )
    );
  }
}


function getIncidentTicket(
  token,
  ticketId
) {
  try {
    const session =
      getSession_(token, true);

    requireTicketView_(session);
    ensureTicketSheets_();

    const ticket =
      ticketReadSheet_(
        MLN_TICKET_SHEET
      )
      .find(
        row =>
          String(row.TicketID) ===
          String(ticketId) &&
          !ticketTruthy_(
            row.IsDeleted
          )
      );

    if (!ticket) {
      throw new Error(
        'Tiket gangguan tidak ditemukan.'
      );
    }

    const updates =
      ticketReadSheet_(
        MLN_TICKET_UPDATE_SHEET
      )
      .filter(
        row =>
          String(row.TicketID) ===
          String(ticketId)
      )
      .sort(
        (a, b) =>
          (
            ticketDateMs_(
              b.Timestamp
            ) || 0
          ) -
          (
            ticketDateMs_(
              a.Timestamp
            ) || 0
          )
      )
      .map(ticketPlainRow_);

    return ok_({
      ticket:
        ticketPlainRow_(
          ticket
        ),
      updates
    });

  } catch (e) {
    return fail_(
      'Gagal membuka tiket: ' +
      (
        e &&
        e.message
          ? e.message
          : String(e)
      )
    );
  }
}


function saveIncidentTicket(
  token,
  payload
) {
  try {
    const session =
      getSession_(token, true);

    requireTicketManage_(session);
    ensureTicketSheets_();

    payload =
      payload || {};

    const isEdit =
      !!ticketString_(
        payload.TicketID
      );

    const required = [
      ['Title','Judul Gangguan'],
      ['Category','Kategori Gangguan'],
      ['Severity','Severity'],
      ['City','Nama Kota'],
      ['SiteCode','Site / POP / Data Center'],
      ['Description','Deskripsi Gangguan'],
      ['Impact','Dampak'],
      ['IncidentStart','Waktu Mulai Gangguan'],
      ['AssignedTo','PIC / Assigned To']
    ];

    required.forEach(
      pair => {
        if (
          !ticketString_(
            payload[pair[0]]
          )
        ) {
          throw new Error(
            pair[1] +
            ' wajib diisi.'
          );
        }
      }
    );

    const severity =
      ticketString_(
        payload.Severity
      );

    const category =
      ticketString_(
        payload.Category
      );

    if (
      !MLN_TICKET_SEVERITIES.includes(
        severity
      )
    ) {
      throw new Error(
        'Severity tiket tidak valid.'
      );
    }

    if (
      !MLN_TICKET_CATEGORIES.includes(
        category
      )
    ) {
      throw new Error(
        'Kategori tiket tidak valid.'
      );
    }

    const username =
      ticketString_(
        session.user &&
        session.user.Username
      ) ||
      'SYSTEM';

    const timestamp =
      ticketTimestamp_();

    const baseData = {
      Title:
        ticketString_(
          payload.Title
        ),

      Category:
        category,

      Severity:
        severity,

      City:
        ticketString_(
          payload.City
        ),

      SiteCode:
        ticketString_(
          payload.SiteCode
        ),

      DeviceID:
        ticketString_(
          payload.DeviceID
        ),

      DeviceName:
        ticketString_(
          payload.DeviceName
        ),

      AffectedService:
        ticketString_(
          payload.AffectedService
        ),

      Description:
        ticketString_(
          payload.Description
        ),

      Impact:
        ticketString_(
          payload.Impact
        ),

      IncidentStart:
        ticketString_(
          payload.IncidentStart
        ),

      AssignedTo:
        ticketString_(
          payload.AssignedTo
        ),

      UpdatedAt:
        timestamp
    };

    if (isEdit) {
      const existing =
        ticketReadSheet_(
          MLN_TICKET_SHEET
        )
        .find(
          row =>
            String(row.TicketID) ===
            String(
              payload.TicketID
            ) &&
            !ticketTruthy_(
              row.IsDeleted
            )
        );

      if (!existing) {
        throw new Error(
          'Tiket gangguan tidak ditemukan.'
        );
      }

      const updated =
        ticketUpdateRow_(
          payload.TicketID,
          baseData
        );

      safeTicketUpdateHistory_(
        updated,
        updated.Status,
        '',
        '',
        'Data tiket diperbarui.',
        username
      );

      safeTicketAudit_(
        session,
        'UPDATE_INCIDENT_TICKET',
        payload.TicketID,
        updated.TicketNumber
      );

      return ok_(
        ticketPlainRow_(
          updated
        ),
        'Tiket gangguan berhasil diperbarui.'
      );
    }

    const ticket = Object.assign(
      {},
      baseData,
      {
        TicketID:
          ticketId_(),

        TicketNumber:
          generateTicketNumber_(),

        ReportedAt:
          ticketNowLocal_(),

        Status:
          'OPEN',

        ActionTaken:
          '',

        RootCause:
          '',

        ResolvedAt:
          '',

        ClosedAt:
          '',

        DurationMinutes:
          '',

        IsDeleted:
          false,

        CreatedBy:
          username,

        CreatedAt:
          timestamp
      }
    );

    /*
     * PRIMARY TRANSACTION:
     * If this succeeds, the ticket is considered saved.
     */
    ticketAppendRow_(
      MLN_TICKET_SHEET,
      ticket
    );

    /*
     * Secondary operations are deliberately non-blocking.
     */
    safeTicketUpdateHistory_(
      ticket,
      'OPEN',
      '',
      '',
      'Tiket gangguan dibuat.',
      username
    );

    safeTicketAudit_(
      session,
      'CREATE_INCIDENT_TICKET',
      ticket.TicketID,
      ticket.TicketNumber
    );

    return ok_(
      ticketPlainRow_(
        ticket
      ),
      `Tiket ${ticket.TicketNumber} berhasil dibuat.`
    );

  } catch (e) {
    console.error(
      'saveIncidentTicket ERROR:',
      e &&
      e.stack
        ? e.stack
        : e
    );

    return fail_(
      'Gagal menyimpan tiket: ' +
      (
        e &&
        e.message
          ? e.message
          : String(e)
      )
    );
  }
}


function updateIncidentTicketProgress(
  token,
  ticketId,
  payload
) {
  try {
    const session =
      getSession_(token, true);

    requireTicketManage_(session);
    ensureTicketSheets_();

    payload =
      payload || {};

    const ticket =
      ticketReadSheet_(
        MLN_TICKET_SHEET
      )
      .find(
        row =>
          String(row.TicketID) ===
          String(ticketId) &&
          !ticketTruthy_(
            row.IsDeleted
          )
      );

    if (!ticket) {
      throw new Error(
        'Tiket gangguan tidak ditemukan.'
      );
    }

    const status =
      ticketUpper_(
        payload.Status
      );

    if (
      !MLN_TICKET_STATUSES.includes(
        status
      )
    ) {
      throw new Error(
        'Status tiket tidak valid.'
      );
    }

    const actionTaken =
      ticketString_(
        payload.ActionTaken
      );

    const rootCause =
      ticketString_(
        payload.RootCause
      );

    const note =
      ticketString_(
        payload.Note
      );

    if (
      [
        'IN PROGRESS',
        'MONITORING',
        'RESOLVED',
        'CLOSED'
      ].includes(status) &&
      !actionTaken
    ) {
      throw new Error(
        'Action / penanganan wajib diisi.'
      );
    }

    const patch = {
      Status:status,

      ActionTaken:
        actionTaken ||
        ticketString_(
          ticket.ActionTaken
        ),

      RootCause:
        rootCause ||
        ticketString_(
          ticket.RootCause
        ),

      UpdatedAt:
        ticketTimestamp_()
    };

    if (status === 'RESOLVED') {
      patch.ResolvedAt =
        ticketString_(
          payload.ResolvedAt
        ) ||
        ticketString_(
          ticket.ResolvedAt
        ) ||
        ticketNowLocal_();

      patch.DurationMinutes =
        calculateTicketDuration_(
          ticket.IncidentStart,
          patch.ResolvedAt
        );
    }

    if (status === 'CLOSED') {
      patch.ResolvedAt =
        ticketString_(
          ticket.ResolvedAt
        ) ||
        ticketString_(
          payload.ResolvedAt
        ) ||
        ticketNowLocal_();

      patch.ClosedAt =
        ticketString_(
          payload.ClosedAt
        ) ||
        ticketString_(
          ticket.ClosedAt
        ) ||
        ticketNowLocal_();

      patch.DurationMinutes =
        calculateTicketDuration_(
          ticket.IncidentStart,
          patch.ResolvedAt
        );
    }

    const updated =
      ticketUpdateRow_(
        ticketId,
        patch
      );

    safeTicketUpdateHistory_(
      updated,
      status,
      actionTaken,
      rootCause,
      note,
      ticketString_(
        session.user &&
        session.user.Username
      )
    );

    safeTicketAudit_(
      session,
      'UPDATE_INCIDENT_STATUS',
      ticketId,
      `${ticket.TicketNumber} -> ${status}`
    );

    return ok_(
      ticketPlainRow_(
        updated
      ),
      'Progress tiket berhasil diperbarui.'
    );

  } catch (e) {
    console.error(
      'updateIncidentTicketProgress ERROR:',
      e &&
      e.stack
        ? e.stack
        : e
    );

    return fail_(
      'Gagal memperbarui progress: ' +
      (
        e &&
        e.message
          ? e.message
          : String(e)
      )
    );
  }
}


function deactivateIncidentTicket(
  token,
  ticketId
) {
  try {
    const session =
      getSession_(token, true);

    requireTicketDelete_(session);
    ensureTicketSheets_();

    const ticket =
      ticketReadSheet_(
        MLN_TICKET_SHEET
      )
      .find(
        row =>
          String(row.TicketID) ===
          String(ticketId) &&
          !ticketTruthy_(
            row.IsDeleted
          )
      );

    if (!ticket) {
      throw new Error(
        'Tiket gangguan tidak ditemukan.'
      );
    }

    const updated =
      ticketUpdateRow_(
        ticketId,
        {
          IsDeleted:true,
          UpdatedAt:
            ticketTimestamp_()
        }
      );

    safeTicketUpdateHistory_(
      updated,
      updated.Status,
      '',
      '',
      'Tiket dihapus (soft delete).',
      ticketString_(
        session.user &&
        session.user.Username
      )
    );

    safeTicketAudit_(
      session,
      'DELETE_INCIDENT_TICKET',
      ticketId,
      ticket.TicketNumber
    );

    return ok_(
      null,
      'Tiket gangguan berhasil dihapus.'
    );

  } catch (e) {
    return fail_(
      'Gagal menghapus tiket: ' +
      (
        e &&
        e.message
          ? e.message
          : String(e)
      )
    );
  }
}


/**
 * Jalankan manual dari Apps Script bila ingin memeriksa
 * kesiapan storage tiket tanpa membuat tiket.
 */
function diagnoseIncidentTicketModule() {
  const result = {
    ok:false,
    spreadsheetId:'',
    ticketsSheet:false,
    updatesSheet:false,
    ticketHeaders:[],
    updateHeaders:[],
    message:''
  };

  try {
    const ss = getDb_();
    result.spreadsheetId =
      ss.getId();

    const sheets =
      ensureTicketSheets_();

    result.ticketsSheet =
      !!sheets.ticketSheet;

    result.updatesSheet =
      !!sheets.updateSheet;

    result.ticketHeaders =
      sheets.ticketSheet
        .getRange(
          1,
          1,
          1,
          sheets.ticketSheet
            .getLastColumn()
        )
        .getValues()[0];

    result.updateHeaders =
      sheets.updateSheet
        .getRange(
          1,
          1,
          1,
          sheets.updateSheet
            .getLastColumn()
        )
        .getValues()[0];

    result.ok = true;
    result.message =
      'Ticket storage siap digunakan.';

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  } catch (e) {
    result.message =
      e &&
      e.message
        ? e.message
        : String(e);

    console.error(
      'diagnoseIncidentTicketModule:',
      e
    );

    return result;
  }
}
