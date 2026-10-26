function auditRaw_(userId, username, action, module, referenceId, description) {
  try {
    append_(APP.SHEETS.AUDIT_LOG, {
      LogID: uuid_(APP.ID_PREFIX.AUDIT_LOG),
      Timestamp: now_(),
      UserID: userId || '',
      Username: username || '',
      Action: action || '',
      Module: module || '',
      ReferenceID: referenceId || '',
      Description: description || ''
    });
  } catch (e) {
    console.error('Audit error', e);
  }
}

function audit_(session, action, module, referenceId, description) {
  auditRaw_(session.user.UserID, session.user.Username, action, module, referenceId, description);
}

function listAuditLogs(token, query) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'audit.view');
    let data = rows_(APP.SHEETS.AUDIT_LOG);
    const q = lower_((query || {}).search);
    if (q) data = data.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    data.sort((a,b) => compareValues_(b.Timestamp, a.Timestamp, 'asc'));
    return ok_(paginate_(data.map(publicRow_), query || {}));
  } catch (e) { return fail_(e.message); }
}
