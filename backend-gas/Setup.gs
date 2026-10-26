function setupApplication() {
  Object.keys(DB_SCHEMA).forEach(key => ensureSheet_(APP.SHEETS[key] || key, DB_SCHEMA[key]));

  const defaults = [
    ['COMPANY_NAME', APP.COMPANY, 'Nama perusahaan'],
    ['APP_NAME', APP.NAME, 'Nama aplikasi'],
    ['LETTER_SEQUENCE_RESET', 'YEARLY', 'Reset nomor surat'],
    ['SESSION_TIMEOUT', String(APP.DEFAULT_SESSION_TIMEOUT), 'Session timeout dalam detik'],
    ['TIMEZONE', APP.TIMEZONE, 'Timezone aplikasi'],
    ['DATE_FORMAT', APP.DATE_FORMAT, 'Format tanggal']
  ];
  defaults.forEach(x => {
    if (!findBy_(APP.SHEETS.SETTINGS, 'Key', x[0], true)) setSetting_(x[0], x[1], x[2]);
  });

  const types = {
    PRT:'Peraturan', KEP:'Keputusan', EDR:'Edaran', KET:'Keterangan',
    HIM:'Himbauan', TGS:'Tugas', BPM:'Balasan Permohonan', PED:'Pedoman',
    INT:'Instruksi', PER:'Pernyataan', REK:'Rekomendasi',
    PKSP:'Perjanjian Kerja Sama Pemasaran', PMN:'Permohonan',
    PBN:'Perjanjian Berlangganan', KSA:'Kuasa', PO:'Purchase Order',
    PNW:'Penawaran', LOA:'Letter of Authorization', PGR:'Pengiriman',
    BAK:'Berita Acara Kesepakatan', BA:'Berita Acara', BRT:'Pemberitahuan',
    PKSI:'Perjanjian Kerja Sama Instansi', SRT:'Sertifikat', PRJ:'Perjanjian'
  };
  Object.keys(types).forEach(code => {
    if (!findBy_(APP.SHEETS.LETTER_TYPES, 'KodeJenis', code, true)) {
      append_(APP.SHEETS.LETTER_TYPES, {
        LetterTypeID: uuid_(APP.ID_PREFIX.LETTER_TYPES),
        KodeJenis: code, NamaJenis: types[code], Status: 'ACTIVE',
        CreatedAt: now_(), UpdatedAt: now_()
      });
    }
  });

  if (!findBy_(APP.SHEETS.UNITS, 'KodeUnit', 'A', true)) {
    append_(APP.SHEETS.UNITS, {
      UnitID: uuid_(APP.ID_PREFIX.UNITS), KodeUnit: 'A',
      NamaUnit: 'Administrasi', Status: 'ACTIVE',
      CreatedAt: now_(), UpdatedAt: now_()
    });
  }

  ['Router','Switch','OLT','Server','Firewall','Optical Device','Access Point','UPS','PDU','Modem','ONT','SFP','Perangkat Lainnya']
    .forEach(name => {
      if (!findBy_(APP.SHEETS.DEVICE_TYPES, 'NamaJenis', name, true)) {
        append_(APP.SHEETS.DEVICE_TYPES, {
          DeviceTypeID: uuid_(APP.ID_PREFIX.DEVICE_TYPES),
          NamaJenis: name, Status: 'ACTIVE', CreatedAt: now_(), UpdatedAt: now_()
        });
      }
    });

  let admin = findBy_(APP.SHEETS.USERS, 'Role', 'SUPER_ADMIN', true);
  let generatedPassword = '';
  if (!admin) {
    generatedPassword = randomPassword_(14);
    const salt = newSalt_();
    admin = {
      UserID: uuid_(APP.ID_PREFIX.USERS),
      Username: 'superadmin',
      PasswordHash: hashPassword_(generatedPassword, salt),
      Salt: salt,
      Nama: 'Super Administrator',
      Email: '',
      Role: 'SUPER_ADMIN',
      Divisi: 'Management',
      Status: 'ACTIVE',
      MustChangePassword: true,
      LastLogin: '',
      CreatedAt: now_(),
      UpdatedAt: now_()
    };
    append_(APP.SHEETS.USERS, admin);
  }

  return {
    success: true,
    message: 'Setup aplikasi berhasil.',
    spreadsheetId: getDb_().getId(),
    superAdminUsername: admin.Username,
    temporaryPassword: generatedPassword || '(sudah pernah dibuat; password lama tidak diubah)',
    note: generatedPassword ? 'Login lalu segera ganti password Super Admin.' : 'Setup aman dijalankan ulang; data tidak dihapus.'
  };
}
