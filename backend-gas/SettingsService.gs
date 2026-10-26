function getSettings(token){
  try{const s=getSession_(token,true);requirePermission_(s,'settings.view');return ok_(rows_(APP.SHEETS.SETTINGS).map(publicRow_));}
  catch(e){return fail_(e.message);}
}

function saveSetting(token,key,value,description){
  try{const s=getSession_(token,true);requirePermission_(s,'settings.manage');const x=setSetting_(normalize_(key),normalize_(value),normalize_(description));audit_(s,'UPDATE_SETTING','SETTINGS',key,'Setting diperbarui');return ok_(publicRow_(x),'Setting berhasil diperbarui.');}
  catch(e){return fail_(e.message);}
}
