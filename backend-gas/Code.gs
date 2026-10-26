/**
 * MLN Management System — API Gateway
 * Backend-only Google Apps Script deployment.
 */

const API_ACTIONS = Object.freeze({
  healthCheck: (...args) => healthCheck(...args),

  login: (...args) => login(...args),
  logout: (...args) => logout(...args),
  me: (...args) => me(...args),
  changeMyPassword: (...args) => changeMyPassword(...args),
  requestPasswordReset: (...args) => requestPasswordReset(...args),
  confirmPasswordReset: (...args) => confirmPasswordReset(...args),

  getDashboardSummary: (...args) => getDashboardSummary(...args),

  listLetters: (...args) => listLetters(...args),
  generateLetter: (...args) => generateLetter(...args),

  getMasterData: (...args) => getMasterData(...args),
  saveMasterItem: (...args) => saveMasterItem(...args),

  listDevices: (...args) => listDevices(...args),
  saveDevice: (...args) => saveDevice(...args),
  deactivateDevice: (...args) => deactivateDevice(...args),
  getDeviceHistory: (...args) => getDeviceHistory(...args),

  listSites: (...args) => listSites(...args),
  saveSite: (...args) => saveSite(...args),
  deactivateSite: (...args) => deactivateSite(...args),

  listRacks: (...args) => listRacks(...args),
  saveRack: (...args) => saveRack(...args),

  listPermits: (...args) => listPermits(...args),
  createPermit: (...args) => createPermit(...args),
  decidePermit: (...args) => decidePermit(...args),
  completePermit: (...args) => completePermit(...args),

  listDeviceIn: (...args) => listDeviceIn(...args),
  createDeviceIn: (...args) => createDeviceIn(...args),
  listDeviceOut: (...args) => listDeviceOut(...args),
  createDeviceOut: (...args) => createDeviceOut(...args),
  listMovements: (...args) => listMovements(...args),

  listUsers: (...args) => listUsers(...args),
  saveUser: (...args) => saveUser(...args),

  listAuditLogs: (...args) => listAuditLogs(...args),

  getSettings: (...args) => getSettings(...args),

  listIncidentTickets: (...args) => listIncidentTickets(...args),
  getIncidentTicket: (...args) => getIncidentTicket(...args),
  saveIncidentTicket: (...args) => saveIncidentTicket(...args),
  updateIncidentTicketProgress: (...args) =>
    updateIncidentTicketProgress(...args),
  deactivateIncidentTicket: (...args) =>
    deactivateIncidentTicket(...args)
});


function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function doGet() {
  return jsonResponse_({
    success: true,
    message: 'MLN Management API online.',
    data: {
      app: APP.NAME,
      time: Utilities.formatDate(
        new Date(),
        APP.TIMEZONE,
        "yyyy-MM-dd'T'HH:mm:ss"
      )
    }
  });
}


function doPost(e) {
  try {
    const raw =
      e &&
      e.postData &&
      e.postData.contents
        ? e.postData.contents
        : '{}';

    const body = JSON.parse(raw);

    const expected =
      PropertiesService
        .getScriptProperties()
        .getProperty('API_SHARED_SECRET');

    if (!expected) {
      return jsonResponse_(
        fail_(
          'API_SHARED_SECRET belum dikonfigurasi pada Script Properties.',
          'API_NOT_CONFIGURED'
        )
      );
    }

    if (
      !constantTimeEqual_(
        String(body.secret || ''),
        String(expected)
      )
    ) {
      return jsonResponse_(
        fail_(
          'Unauthorized API request.',
          'UNAUTHORIZED'
        )
      );
    }

    const action =
      String(body.action || '').trim();

    const args =
      Array.isArray(body.args)
        ? body.args
        : [];

    const handler =
      API_ACTIONS[action];

    if (!handler) {
      return jsonResponse_(
        fail_(
          `Action API tidak dikenal: ${action}`,
          'UNKNOWN_ACTION'
        )
      );
    }

    const result =
      handler(...args);

    return jsonResponse_(result);

  } catch (error) {
    console.error(
      'API doPost ERROR:',
      error &&
      error.stack
        ? error.stack
        : error
    );

    return jsonResponse_(
      fail_(
        'API error: ' +
        (
          error &&
          error.message
            ? error.message
            : String(error)
        ),
        'API_ERROR'
      )
    );
  }
}


/**
 * Jalankan manual satu kali.
 * Copy secret dari Execution log ke Vercel GAS_API_SECRET.
 */
function setupApiSharedSecret() {
  const props =
    PropertiesService
      .getScriptProperties();

  let secret =
    props.getProperty(
      'API_SHARED_SECRET'
    );

  if (!secret) {
    secret = sha256Hex_(
      Utilities.getUuid() +
      ':' +
      Date.now() +
      ':' +
      Utilities.getUuid()
    );

    props.setProperty(
      'API_SHARED_SECRET',
      secret
    );
  }

  console.log(
    'GAS_API_SECRET=' + secret
  );

  return {
    success: true,
    message:
      'API shared secret siap. Copy dari Execution log ke Vercel.',
    secret
  };
}


/**
 * Opsional untuk standalone Apps Script.
 * Bila project masih bound ke Spreadsheet lama, fungsi ini tidak wajib.
 */
function configureSpreadsheetId(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error(
      'Spreadsheet ID wajib diisi.'
    );
  }

  SpreadsheetApp.openById(
    spreadsheetId
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'SPREADSHEET_ID',
      String(spreadsheetId).trim()
    );

  return {
    success: true,
    spreadsheetId:
      String(spreadsheetId).trim()
  };
}


function healthCheck() {
  try {
    return ok_({
      app: APP.NAME,
      database: 'Google Sheets',
      time: Utilities.formatDate(
        new Date(),
        APP.TIMEZONE,
        APP.DATETIME_FORMAT
      )
    });
  } catch (e) {
    return fail_(e.message);
  }
}
