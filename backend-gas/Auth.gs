function login(username, password) {
  try {
    username = normalize_(username);
    password = String(password || '');
    if (!username || !password) return fail_('Username dan password wajib diisi.', 'VALIDATION');

    const user = findBy_(APP.SHEETS.USERS, 'Username', username, true);
    if (!user || upper_(user.Status) !== 'ACTIVE') {
      return fail_('Username atau password salah.', 'AUTH');
    }
    const expected = hashPassword_(password, user.Salt);
    if (!constantTimeEqual_(expected, user.PasswordHash)) {
      auditRaw_(user.UserID || '', user.Username || username, 'LOGIN_FAILED', 'AUTH', '', 'Login gagal');
      return fail_('Username atau password salah.', 'AUTH');
    }

    const token = Utilities.getUuid() + Utilities.getUuid();
    const timeout = Math.max(300, Math.min(21600, Number(getSetting_('SESSION_TIMEOUT', APP.DEFAULT_SESSION_TIMEOUT))));
    const safeUser = sanitizeUser_(user);
    CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify({
      user: safeUser,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeout * 1000
    }), timeout);

    updateById_(APP.SHEETS.USERS, 'UserID', user.UserID, { LastLogin: now_(), UpdatedAt: now_() });
    auditRaw_(user.UserID, user.Username, 'LOGIN', 'AUTH', user.UserID, 'Login berhasil');

    return ok_({
      token: token,
      user: safeUser,
      permissions: permissionsForRole_(safeUser.Role),
      sessionTimeout: timeout
    }, 'Login berhasil.');
  } catch (e) {
    console.error(e);
    return fail_('Login gagal. Pastikan setup aplikasi sudah dilakukan.');
  }
}

function logout(token) {
  try {
    const s = getSession_(token, false);
    if (s) auditRaw_(s.user.UserID, s.user.Username, 'LOGOUT', 'AUTH', s.user.UserID, 'Logout');
    CacheService.getScriptCache().remove('SESSION_' + String(token || ''));
    return ok_(null, 'Logout berhasil.');
  } catch (e) {
    return ok_(null, 'Logout selesai.');
  }
}

function me(token) {
  try {
    const s = getSession_(token, true);
    return ok_({ user: s.user, permissions: permissionsForRole_(s.user.Role) });
  } catch (e) {
    return fail_(e.message, 'SESSION');
  }
}

function getSession_(token, renew) {
  token = String(token || '');
  if (!token) throw new Error('Session tidak tersedia. Silakan login kembali.');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('SESSION_' + token);
  if (!raw) throw new Error('Session berakhir. Silakan login kembali.');
  const session = JSON.parse(raw);
  if (Date.now() > Number(session.expiresAt || 0)) {
    cache.remove('SESSION_' + token);
    throw new Error('Session berakhir. Silakan login kembali.');
  }
  const dbUser = findBy_(APP.SHEETS.USERS, 'UserID', session.user.UserID, false);
  if (!dbUser || upper_(dbUser.Status) !== 'ACTIVE') throw new Error('User tidak aktif.');
  session.user = sanitizeUser_(dbUser);

  if (renew !== false) {
    const timeout = Math.max(300, Math.min(21600, Number(getSetting_('SESSION_TIMEOUT', APP.DEFAULT_SESSION_TIMEOUT))));
    session.expiresAt = Date.now() + timeout * 1000;
    cache.put('SESSION_' + token, JSON.stringify(session), timeout);
  }
  return session;
}

function sanitizeUser_(u) {
  return {
    UserID: u.UserID, Username: u.Username, Nama: u.Nama, Email: u.Email,
    Role: u.Role, Divisi: u.Divisi, Status: u.Status,
    MustChangePassword: String(u.MustChangePassword).toLowerCase() === 'true',
    LastLogin: u.LastLogin ? formatDate_(u.LastLogin) : ''
  };
}

function changeMyPassword(token, currentPassword, newPassword) {
  try {
    const s = getSession_(token, true);
    if (String(newPassword || '').length < 8) return fail_('Password baru minimal 8 karakter.', 'VALIDATION');
    const user = findBy_(APP.SHEETS.USERS, 'UserID', s.user.UserID);
    if (!constantTimeEqual_(hashPassword_(String(currentPassword || ''), user.Salt), user.PasswordHash)) {
      return fail_('Password saat ini tidak sesuai.', 'AUTH');
    }
    const salt = newSalt_();
    updateById_(APP.SHEETS.USERS, 'UserID', user.UserID, {
      Salt: salt, PasswordHash: hashPassword_(newPassword, salt),
      MustChangePassword: false, UpdatedAt: now_()
    });
    audit_(s, 'CHANGE_PASSWORD', 'USERS', user.UserID, 'User mengganti password');
    return ok_(null, 'Password berhasil diubah.');
  } catch (e) {
    return fail_(e.message);
  }
}
