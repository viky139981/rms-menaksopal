function getDashboardSummary(token) {
  try {
    const s = getSession_(token, true);
    requirePermission_(s, 'dashboard.view');

    const devices = rows_(APP.SHEETS.DEVICES).filter(d => !truthy_(d.IsDeleted));
    const sites = rows_(APP.SHEETS.SITES).filter(x => !truthy_(x.IsDeleted) && upper_(x.Status) === 'ACTIVE');
    const racks = rows_(APP.SHEETS.RACKS).filter(x => !truthy_(x.IsDeleted) && upper_(x.Status) === 'ACTIVE');
    const permits = rows_(APP.SHEETS.DC_PERMITS);
    const ins = rows_(APP.SHEETS.DEVICE_IN);
    const outs = rows_(APP.SHEETS.DEVICE_OUT);
    const dcCodes = new Set(sites.filter(s => upper_(s.TipeSite) === 'DATA CENTER').map(s => String(s.KodeSite)));

    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const inMonth = ins.filter(r => sameMonth_(r.TanggalMasuk, y, m)).length;
    const outMonth = outs.filter(r => sameMonth_(r.TanggalKeluar, y, m)).length;

    const byType = {};
    devices.forEach(d => byType[d.JenisDevice || 'Lainnya'] = (byType[d.JenisDevice || 'Lainnya'] || 0) + 1);

    const bySite = {};
    devices.forEach(d => {
      const k = d.SiteCode || 'Tanpa Site';
      bySite[k] = (bySite[k] || 0) + 1;
    });

    const recent = rows_(APP.SHEETS.AUDIT_LOG)
      .sort((a,b) => new Date(b.Timestamp) - new Date(a.Timestamp))
      .slice(0,8).map(publicRow_);

    return ok_({
      totalDevices: devices.length,
      devicesInDataCenter: devices.filter(d => dcCodes.has(String(d.SiteCode))).length,
      totalDataCenters: dcCodes.size,
      totalRacks: racks.length,
      pendingPermits: permits.filter(p => upper_(p.Status) === 'PENDING').length,
      deviceInThisMonth: inMonth,
      deviceOutThisMonth: outMonth,
      devicesByType: byType,
      devicesBySite: bySite,
      recentActivity: recent
    });
  } catch (e) { return fail_(e.message); }
}

function sameMonth_(value, year, monthZero) {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d) && d.getFullYear() === year && d.getMonth() === monthZero;
}

function truthy_(v) {
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function publicRow_(r) {
  const out = {};
  Object.keys(r || {}).forEach(k => {
    if (k !== '_row' && !['PasswordHash','Salt'].includes(k)) {
      out[k] = r[k] instanceof Date ? formatDate_(r[k]) : r[k];
    }
  });
  return out;
}
