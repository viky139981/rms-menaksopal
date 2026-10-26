const APP = Object.freeze({
  NAME: 'MLN Management System',
  COMPANY: 'PT Menaksopal Link Nusantara',
  TIMEZONE: 'Asia/Jakarta',
  DATE_FORMAT: 'dd/MM/yyyy',
  DATETIME_FORMAT: 'dd/MM/yyyy HH:mm:ss',

  SHEETS: {
    USERS: 'USERS',
    LETTERS: 'LETTERS',
    LETTER_TYPES: 'LETTER_TYPES',
    UNITS: 'UNITS',
    DEVICE_TYPES: 'DEVICE_TYPES',
    DEVICES: 'DEVICES',
    SITES: 'SITES',
    RACKS: 'RACKS',
    DC_PERMITS: 'DC_PERMITS',
    DEVICE_IN: 'DEVICE_IN',
    DEVICE_OUT: 'DEVICE_OUT',
    DEVICE_MOVEMENTS: 'DEVICE_MOVEMENTS',
    AUDIT_LOG: 'AUDIT_LOG',
    SETTINGS: 'SETTINGS',
    TICKETS: 'TICKETS',
    TICKET_UPDATES: 'TICKET_UPDATES'
  },

  ID_PREFIX: {
    USERS: 'USR',
    LETTERS: 'LTR',
    LETTER_TYPES: 'LTYP',
    UNITS: 'UNIT',
    DEVICE_TYPES: 'DTYP',
    DEVICES: 'DEV',
    SITES: 'SITE',
    RACKS: 'RACK',
    DC_PERMITS: 'PERMIT',
    DEVICE_IN: 'DIN',
    DEVICE_OUT: 'DOUT',
    DEVICE_MOVEMENTS: 'MOV',
    AUDIT_LOG: 'LOG',
    TICKETS: 'TKT',
    TICKET_UPDATES: 'TUP'
  },

  DEFAULT_SESSION_TIMEOUT: 3600,
  MAX_PAGE_SIZE: 5000,
  DEFAULT_PAGE_SIZE: 20
});


const ROLE_PERMISSIONS = Object.freeze({
  SUPER_ADMIN: ['*'],

  ADMIN: [
    'dashboard.view',
    'letters.view','letters.create','letters.update',
    'devices.view','devices.create','devices.update','devices.deactivate',
    'sites.view','sites.create','sites.update','sites.deactivate',
    'racks.view','racks.create','racks.update','racks.deactivate',
    'permits.view','permits.create',
    'devicein.view','devicein.create',
    'deviceout.view','deviceout.create',
    'movements.view',
    'tickets.view','tickets.manage','tickets.delete',
    'master.view','master.manage',
    'audit.view',
    'users.view','users.manage',
    'settings.view','settings.manage'
  ],

  NOC: [
    'dashboard.view',
    'letters.view',
    'devices.view','devices.create','devices.update',
    'sites.view','sites.create','sites.update',
    'racks.view','racks.create','racks.update',
    'permits.view','permits.create',
    'devicein.view','devicein.create',
    'deviceout.view','deviceout.create',
    'movements.view',
    'tickets.view','tickets.manage',
    'master.view'
  ],

  APPROVER: [
    'dashboard.view',
    'permits.view','permits.approve','permits.reject',
    'tickets.view',
    'master.view'
  ],

  VIEWER: [
    'dashboard.view',
    'letters.view',
    'devices.view',
    'sites.view',
    'racks.view',
    'permits.view',
    'devicein.view',
    'deviceout.view',
    'movements.view',
    'tickets.view',
    'master.view'
  ]
});
