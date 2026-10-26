/**
 * PasswordResetService.gs
 * Reset password via verification code sent to the email registered in USERS.
 */

function requestPasswordReset(identifier) {
  const genericMessage =
    'Jika akun ditemukan dan memiliki email aktif, kode verifikasi telah dikirim.';

  try {
    identifier = normalize_(identifier);

    if (!identifier) {
      return fail_('Username atau email wajib diisi.', 'VALIDATION');
    }

    const users = rows_(APP.SHEETS.USERS);
    const needle = lower_(identifier);

    const user = users.find(u =>
      lower_(u.Username) === needle ||
      lower_(u.Email) === needle
    );

    // Hindari account enumeration.
    if (
      !user ||
      upper_(user.Status) !== 'ACTIVE' ||
      !normalize_(user.Email)
    ) {
      return ok_(null, genericMessage);
    }

    const raw = sha256Hex_(
      Utilities.getUuid() + ':' +
      Date.now() + ':' +
      user.UserID
    );

    const code = String(
      parseInt(raw.substring(0, 8), 16) % 1000000
    ).padStart(6, '0');

    const cacheKey = 'PWDRESET_' + user.UserID;

    const payload = {
      code: code,
      userId: user.UserID,
      createdAt: Date.now()
    };

    CacheService
      .getScriptCache()
      .put(cacheKey, JSON.stringify(payload), 600);

    MailApp.sendEmail({
      to: String(user.Email),
      subject: APP.NAME + ' - Kode Reset Password',
      name: APP.NAME,
      htmlBody:
        '<div style="font-family:Arial,sans-serif;color:#172033">' +
          '<h2 style="margin-bottom:8px">Reset Password</h2>' +
          '<p>Halo <b>' +
            escapeHtml_(user.Nama || user.Username) +
          '</b>,</p>' +
          '<p>Kode verifikasi untuk reset password MLN Management System:</p>' +
          '<div style="font-size:28px;font-weight:700;letter-spacing:8px;' +
          'padding:16px;background:#f3f6fb;border-radius:10px;' +
          'display:inline-block">' +
            code +
          '</div>' +
          '<p style="margin-top:16px">' +
            'Kode berlaku selama <b>10 menit</b>. ' +
            'Abaikan email ini jika Anda tidak meminta reset password.' +
          '</p>' +
        '</div>'
    });

    auditRaw_(
      user.UserID,
      user.Username,
      'PASSWORD_RESET_REQUEST',
      'AUTH',
      user.UserID,
      'Kode reset password dikirim'
    );

    return ok_(null, genericMessage);

  } catch (e) {
    console.error(
      'requestPasswordReset ERROR:',
      e && e.stack ? e.stack : e
    );

    return fail_(
      'Permintaan reset password belum dapat diproses. ' +
      'Silakan coba kembali atau hubungi administrator.'
    );
  }
}


function confirmPasswordReset(identifier, code, newPassword) {
  try {
    identifier = normalize_(identifier);
    code = normalize_(code);
    newPassword = String(newPassword || '');

    if (!identifier || !code || !newPassword) {
      return fail_(
        'Data reset password belum lengkap.',
        'VALIDATION'
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return fail_(
        'Kode verifikasi harus 6 digit.',
        'VALIDATION'
      );
    }

    if (newPassword.length < 8) {
      return fail_(
        'Password baru minimal 8 karakter.',
        'VALIDATION'
      );
    }

    const users = rows_(APP.SHEETS.USERS);
    const needle = lower_(identifier);

    const user = users.find(u =>
      lower_(u.Username) === needle ||
      lower_(u.Email) === needle
    );

    if (!user || upper_(user.Status) !== 'ACTIVE') {
      return fail_(
        'Kode verifikasi tidak valid atau sudah kedaluwarsa.',
        'AUTH'
      );
    }

    const cacheKey = 'PWDRESET_' + user.UserID;
    const raw = CacheService.getScriptCache().get(cacheKey);

    if (!raw) {
      return fail_(
        'Kode verifikasi tidak valid atau sudah kedaluwarsa.',
        'AUTH'
      );
    }

    const reset = JSON.parse(raw);

    if (
      String(reset.userId) !== String(user.UserID) ||
      !constantTimeEqual_(String(reset.code), code)
    ) {
      return fail_(
        'Kode verifikasi tidak valid atau sudah kedaluwarsa.',
        'AUTH'
      );
    }

    const salt = newSalt_();

    updateById_(
      APP.SHEETS.USERS,
      'UserID',
      user.UserID,
      {
        Salt: salt,
        PasswordHash: hashPassword_(newPassword, salt),
        MustChangePassword: false,
        UpdatedAt: now_()
      }
    );

    CacheService
      .getScriptCache()
      .remove(cacheKey);

    auditRaw_(
      user.UserID,
      user.Username,
      'PASSWORD_RESET_SUCCESS',
      'AUTH',
      user.UserID,
      'Password berhasil direset'
    );

    return ok_(
      null,
      'Password berhasil diubah. Silakan login menggunakan password baru.'
    );

  } catch (e) {
    console.error(
      'confirmPasswordReset ERROR:',
      e && e.stack ? e.stack : e
    );

    return fail_('Reset password gagal diproses.');
  }
}


/**
 * Jalankan manual satu kali dari editor Apps Script
 * untuk meminta otorisasi penggunaan MailApp.
 */
function authorizePasswordResetMail() {
  try {
    const quota = MailApp.getRemainingDailyQuota();

    console.log('===================================');
    console.log('MAILAPP AUTHORIZATION BERHASIL');
    console.log('Sisa quota email hari ini: ' + quota);
    console.log('===================================');

    return 'MailApp siap digunakan. Quota: ' + quota;

  } catch (e) {
    console.error(
      'authorizePasswordResetMail ERROR:',
      e && e.stack ? e.stack : e
    );

    throw e;
  }
}
