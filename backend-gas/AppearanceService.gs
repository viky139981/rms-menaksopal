/**
 * AppearanceService.gs — Three.js personal appearance settings.
 * Self-initializing per-user storage.
 */

const APPEARANCE_SHEET = 'USER_APPEARANCE';

const APPEARANCE_HEADERS = [
  'UserID',
  'BackgroundScene',
  'AnimationIntensity',
  'BackgroundOpacity',
  'MouseParallax',
  'DataFlow',
  'ReduceMotionMobile',
  'UpdatedAt'
];

const APPEARANCE_SCENES = Object.freeze([
  'off',
  'network-globe',
  'core-network-mesh',
  'cyber-grid',
  'data-stream',
  'network-topology',
  'data-center-core',
  'pop-network-map',
  'fiber-backbone',
  'incident-alert',
  'digital-city-nodes',
  'particle-field',
  'hex-tech-grid',
  'radar-core',
  'orbital-core',
  'server-matrix'
]);

const APPEARANCE_INTENSITIES = Object.freeze([
  'LOW',
  'NORMAL',
  'HIGH'
]);


function defaultAppearanceSettings_() {
  return {
    BackgroundScene: 'core-network-mesh',
    AnimationIntensity: 'NORMAL',
    BackgroundOpacity: 33,
    MouseParallax: true,
    DataFlow: true,
    ReduceMotionMobile: true
  };
}


function ensureAppearanceSheet_() {
  const ss = getDb_();
  let sh = ss.getSheetByName(APPEARANCE_SHEET);

  if (!sh) {
    sh = ss.insertSheet(APPEARANCE_SHEET);

    sh
      .getRange(
        1,
        1,
        1,
        APPEARANCE_HEADERS.length
      )
      .setValues([APPEARANCE_HEADERS]);

    sh.setFrozenRows(1);

    sh
      .getRange(
        1,
        1,
        1,
        APPEARANCE_HEADERS.length
      )
      .setFontWeight('bold');

    return sh;
  }

  const lastCol =
    Math.max(sh.getLastColumn(), 1);

  const current =
    sh
      .getRange(
        1,
        1,
        1,
        lastCol
      )
      .getValues()[0]
      .map(String);

  const missing =
    APPEARANCE_HEADERS.filter(
      header => !current.includes(header)
    );

  if (missing.length) {
    sh
      .getRange(
        1,
        current.filter(Boolean).length + 1,
        1,
        missing.length
      )
      .setValues([missing]);

    SpreadsheetApp.flush();
  }

  return sh;
}


function appearanceBool_(value, fallback) {
  if (
    value === true ||
    String(value).toLowerCase() === 'true' ||
    String(value) === '1'
  ) {
    return true;
  }

  if (
    value === false ||
    String(value).toLowerCase() === 'false' ||
    String(value) === '0'
  ) {
    return false;
  }

  return fallback;
}


function sanitizeAppearance_(row) {
  const defaults =
    defaultAppearanceSettings_();

  if (!row) {
    return defaults;
  }

  const scene =
    APPEARANCE_SCENES.includes(
      String(row.BackgroundScene || '')
    )
      ? String(row.BackgroundScene)
      : defaults.BackgroundScene;

  const intensity =
    APPEARANCE_INTENSITIES.includes(
      upper_(row.AnimationIntensity)
    )
      ? upper_(row.AnimationIntensity)
      : defaults.AnimationIntensity;

  const opacity =
    Math.max(
      0,
      Math.min(
        60,
        Number(row.BackgroundOpacity)
      )
    );

  return {
    BackgroundScene: scene,
    AnimationIntensity: intensity,
    BackgroundOpacity:
      Number.isFinite(opacity)
        ? opacity
        : defaults.BackgroundOpacity,
    MouseParallax:
      appearanceBool_(
        row.MouseParallax,
        defaults.MouseParallax
      ),
    DataFlow:
      appearanceBool_(
        row.DataFlow,
        defaults.DataFlow
      ),
    ReduceMotionMobile:
      appearanceBool_(
        row.ReduceMotionMobile,
        defaults.ReduceMotionMobile
      )
  };
}


function getMyAppearanceSettings(token) {
  try {
    const session =
      getSession_(token, true);

    ensureAppearanceSheet_();

    const row =
      findBy_(
        APPEARANCE_SHEET,
        'UserID',
        session.user.UserID,
        false
      );

    return ok_(
      sanitizeAppearance_(row)
    );

  } catch (e) {
    return fail_(
      e.message ||
      'Pengaturan tampilan gagal dimuat.'
    );
  }
}


function saveMyAppearanceSettings(
  token,
  payload
) {
  try {
    const session =
      getSession_(token, true);

    ensureAppearanceSheet_();

    payload =
      payload || {};

    const defaults =
      defaultAppearanceSettings_();

    const scene =
      String(
        payload.BackgroundScene ||
        defaults.BackgroundScene
      );

    if (
      !APPEARANCE_SCENES.includes(scene)
    ) {
      throw new Error(
        'Background Scene tidak valid.'
      );
    }

    const intensity =
      upper_(
        payload.AnimationIntensity ||
        defaults.AnimationIntensity
      );

    if (
      !APPEARANCE_INTENSITIES.includes(
        intensity
      )
    ) {
      throw new Error(
        'Animation Intensity tidak valid.'
      );
    }

    const opacity =
      Number(
        payload.BackgroundOpacity
      );

    if (
      !Number.isFinite(opacity) ||
      opacity < 0 ||
      opacity > 60
    ) {
      throw new Error(
        'Background Opacity harus 0–60%.'
      );
    }

    const data = {
      BackgroundScene: scene,
      AnimationIntensity: intensity,
      BackgroundOpacity:
        Math.round(opacity),
      MouseParallax:
        appearanceBool_(
          payload.MouseParallax,
          true
        ),
      DataFlow:
        appearanceBool_(
          payload.DataFlow,
          true
        ),
      ReduceMotionMobile:
        appearanceBool_(
          payload.ReduceMotionMobile,
          true
        ),
      UpdatedAt: now_()
    };

    const existing =
      findBy_(
        APPEARANCE_SHEET,
        'UserID',
        session.user.UserID,
        false
      );

    if (existing) {
      updateById_(
        APPEARANCE_SHEET,
        'UserID',
        session.user.UserID,
        data
      );
    } else {
      append_(
        APPEARANCE_SHEET,
        Object.assign(
          {
            UserID:
              session.user.UserID
          },
          data
        )
      );
    }

    try {
      audit_(
        session,
        'UPDATE_APPEARANCE',
        'USER_APPEARANCE',
        session.user.UserID,
        `Scene: ${scene}`
      );
    } catch (auditError) {
      console.warn(
        'Appearance audit warning:',
        auditError
      );
    }

    return ok_(
      sanitizeAppearance_(
        Object.assign(
          {
            UserID:
              session.user.UserID
          },
          data
        )
      ),
      'Pengaturan background berhasil disimpan.'
    );

  } catch (e) {
    return fail_(
      e.message ||
      'Pengaturan background gagal disimpan.'
    );
  }
}
