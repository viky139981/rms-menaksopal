function listUsers(token,query){
  try{const s=getSession_(token,true);requirePermission_(s,'users.view');query=query||{};let data=rows_(APP.SHEETS.USERS);
    if(query.search){const q=lower_(query.search);data=data.filter(r=>JSON.stringify({Username:r.Username,Nama:r.Nama,Email:r.Email,Role:r.Role,Divisi:r.Divisi,Status:r.Status}).toLowerCase().includes(q));}
    return ok_(paginate_(data.map(r=>sanitizeUser_(r)),query));
  }catch(e){return fail_(e.message);}
}

function saveUser(token,payload){
  try{const s=getSession_(token,true);requirePermission_(s,'users.manage');payload=cleanObject_(payload||{});const isEdit=!!payload.UserID;assertRequired_(payload,['Username','Nama','Role','Status']);
    if(!ROLE_PERMISSIONS[upper_(payload.Role)])throw new Error('Role tidak valid.');
    const dup=rows_(APP.SHEETS.USERS).find(r=>lower_(r.Username)===lower_(payload.Username)&&String(r.UserID)!==String(payload.UserID||''));if(dup)throw new Error('Username sudah digunakan.');
    if(isEdit){const patch={Username:payload.Username,Nama:payload.Nama,Email:payload.Email||'',Role:upper_(payload.Role),Divisi:payload.Divisi||'',Status:upper_(payload.Status),UpdatedAt:now_()};if(payload.NewPassword){if(String(payload.NewPassword).length<8)throw new Error('Password minimal 8 karakter.');const salt=newSalt_();patch.Salt=salt;patch.PasswordHash=hashPassword_(payload.NewPassword,salt);patch.MustChangePassword=true;}const x=updateById_(APP.SHEETS.USERS,'UserID',payload.UserID,patch);audit_(s,'UPDATE_USER','USERS',payload.UserID,payload.Username);return ok_(sanitizeUser_(x),'User berhasil diperbarui.');}
    if(!payload.NewPassword||String(payload.NewPassword).length<8)throw new Error('Password awal minimal 8 karakter.');const salt=newSalt_();const row={UserID:uuid_(APP.ID_PREFIX.USERS),Username:payload.Username,PasswordHash:hashPassword_(payload.NewPassword,salt),Salt:salt,Nama:payload.Nama,Email:payload.Email||'',Role:upper_(payload.Role),Divisi:payload.Divisi||'',Status:upper_(payload.Status),MustChangePassword:true,LastLogin:'',CreatedAt:now_(),UpdatedAt:now_()};append_(APP.SHEETS.USERS,row);audit_(s,'CREATE_USER','USERS',row.UserID,row.Username);return ok_(sanitizeUser_(row),'User berhasil ditambahkan.');
  }catch(e){return fail_(e.message);}
}
