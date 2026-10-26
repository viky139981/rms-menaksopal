function recordMovement_(session,payload){
  const row={MovementID:uuid_(APP.ID_PREFIX.DEVICE_MOVEMENTS),DeviceID:payload.DeviceID,MovementType:upper_(payload.MovementType),FromSite:payload.FromSite||'',FromRack:payload.FromRack||'',ToSite:payload.ToSite||'',ToRack:payload.ToRack||'',Tanggal:payload.Tanggal||now_(),ReferenceID:payload.ReferenceID||'',Keterangan:payload.Keterangan||'',CreatedBy:session.user.Username,CreatedAt:now_()};
  append_(APP.SHEETS.DEVICE_MOVEMENTS,row);return row;
}

function listMovements(token,query){
  try{const s=getSession_(token,true);requirePermission_(s,'movements.view');query=query||{};let data=rows_(APP.SHEETS.DEVICE_MOVEMENTS);
    if(query.search){const q=lower_(query.search);data=data.filter(r=>JSON.stringify(r).toLowerCase().includes(q));}
    if(query.deviceId)data=data.filter(r=>String(r.DeviceID)===String(query.deviceId));
    data.sort((a,b)=>new Date(b.Tanggal)-new Date(a.Tanggal));return ok_(paginate_(data.map(publicRow_),query));
  }catch(e){return fail_(e.message);}
}

function createDeviceIn(token,payload){
  try{const s=getSession_(token,true);requirePermission_(s,'devicein.create');payload=cleanObject_(payload||{});assertRequired_(payload,['TanggalMasuk','NamaDevice','Brand','JenisDevice','Tipe','KelengkapanDevice','SiteTujuan','Kondisi']);
    if(payload.RackTujuan){const rack=rows_(APP.SHEETS.RACKS).find(r=>!truthy_(r.IsDeleted)&&upper_(r.KodeRack)===upper_(payload.RackTujuan)&&upper_(r.SiteCode)===upper_(payload.SiteTujuan));if(!rack)throw new Error('Rack tujuan tidak sesuai dengan Site tujuan.');}
    let device=null;
    if(payload.DeviceID)device=findBy_(APP.SHEETS.DEVICES,'DeviceID',payload.DeviceID);
    if(!device&&payload.SerialNumber)device=findBy_(APP.SHEETS.DEVICES,'SerialNumber',payload.SerialNumber,true);
    let deviceId;
    if(device){
      deviceId=device.DeviceID;updateById_(APP.SHEETS.DEVICES,'DeviceID',deviceId,{NamaDevice:payload.NamaDevice,Brand:payload.Brand,JenisDevice:payload.JenisDevice,TipeDevice:payload.Tipe,SerialNumber:payload.SerialNumber||device.SerialNumber,SiteCode:upper_(payload.SiteTujuan),RackCode:upper_(payload.RackTujuan||''),RackUnit:payload.RackUnit||'',StatusDevice:'ACTIVE',Kondisi:payload.Kondisi,UpdatedAt:now_()});
    }else{
      if(payload.SerialNumber&&rows_(APP.SHEETS.DEVICES).some(r=>!truthy_(r.IsDeleted)&&lower_(r.SerialNumber)===lower_(payload.SerialNumber)))throw new Error('Serial Number sudah terdaftar.');
      deviceId=uuid_(APP.ID_PREFIX.DEVICES);append_(APP.SHEETS.DEVICES,{DeviceID:deviceId,NamaDevice:payload.NamaDevice,Brand:payload.Brand,JenisDevice:payload.JenisDevice,TipeDevice:payload.Tipe,SerialNumber:payload.SerialNumber||'',IPAddress:'',SiteCode:upper_(payload.SiteTujuan),RackCode:upper_(payload.RackTujuan||''),RackUnit:payload.RackUnit||'',LokasiDevice:'',StatusDevice:'ACTIVE',Kondisi:payload.Kondisi,Keterangan:payload.Keterangan||'',IsDeleted:false,CreatedBy:s.user.Username,CreatedAt:now_(),UpdatedAt:now_()});
    }
    const tx={TransactionID:uuid_(APP.ID_PREFIX.DEVICE_IN),TanggalMasuk:new Date(payload.TanggalMasuk),DeviceID:deviceId,NamaDevice:payload.NamaDevice,Brand:payload.Brand,JenisDevice:payload.JenisDevice,Tipe:payload.Tipe,SerialNumber:payload.SerialNumber||'',KelengkapanDevice:payload.KelengkapanDevice,SiteTujuan:upper_(payload.SiteTujuan),RackTujuan:upper_(payload.RackTujuan||''),RackUnit:payload.RackUnit||'',Kondisi:payload.Kondisi,Keterangan:payload.Keterangan||'',DibawaOleh:payload.DibawaOleh||'',Status:'CONFIRMED',CreatedBy:s.user.Username,CreatedAt:now_()};
    append_(APP.SHEETS.DEVICE_IN,tx);recordMovement_(s,{DeviceID:deviceId,MovementType:'IN',FromSite:'',FromRack:'',ToSite:tx.SiteTujuan,ToRack:tx.RackTujuan,Tanggal:tx.TanggalMasuk,ReferenceID:tx.TransactionID,Keterangan:tx.Keterangan});audit_(s,'DEVICE_IN','DEVICE_IN',tx.TransactionID,tx.NamaDevice);return ok_(publicRow_(tx),'Device IN berhasil dicatat.');
  }catch(e){return fail_(e.message);}
}

function createDeviceOut(token,payload){
  try{const s=getSession_(token,true);requirePermission_(s,'deviceout.create');payload=cleanObject_(payload||{});assertRequired_(payload,['DeviceID','TanggalKeluar','KelengkapanDevice','TujuanKeluar','Keterangan']);
    const d=findBy_(APP.SHEETS.DEVICES,'DeviceID',payload.DeviceID);if(!d||truthy_(d.IsDeleted))throw new Error('Device tidak ditemukan.');
    const tx={TransactionID:uuid_(APP.ID_PREFIX.DEVICE_OUT),TanggalKeluar:new Date(payload.TanggalKeluar),DeviceID:d.DeviceID,NamaDevice:d.NamaDevice,Brand:d.Brand,JenisDevice:d.JenisDevice,Tipe:d.TipeDevice,SerialNumber:d.SerialNumber,KelengkapanDevice:payload.KelengkapanDevice,SiteAsal:d.SiteCode,RackAsal:d.RackCode,TujuanKeluar:payload.TujuanKeluar,DibawaOleh:payload.DibawaOleh||'',Keterangan:payload.Keterangan,Status:'CONFIRMED',CreatedBy:s.user.Username,CreatedAt:now_()};
    append_(APP.SHEETS.DEVICE_OUT,tx);updateById_(APP.SHEETS.DEVICES,'DeviceID',d.DeviceID,{StatusDevice:'KELUAR',SiteCode:'',RackCode:'',RackUnit:'',UpdatedAt:now_()});recordMovement_(s,{DeviceID:d.DeviceID,MovementType:'OUT',FromSite:d.SiteCode,FromRack:d.RackCode,ToSite:'',ToRack:'',Tanggal:tx.TanggalKeluar,ReferenceID:tx.TransactionID,Keterangan:payload.TujuanKeluar+' - '+payload.Keterangan});audit_(s,'DEVICE_OUT','DEVICE_OUT',tx.TransactionID,d.NamaDevice);return ok_(publicRow_(tx),'Device OUT berhasil dicatat.');
  }catch(e){return fail_(e.message);}
}

function listDeviceIn(token,query){
  try{const s=getSession_(token,true);requirePermission_(s,'devicein.view');let data=rows_(APP.SHEETS.DEVICE_IN);query=query||{};if(query.search){const q=lower_(query.search);data=data.filter(r=>JSON.stringify(r).toLowerCase().includes(q));}data.sort((a,b)=>new Date(b.TanggalMasuk)-new Date(a.TanggalMasuk));return ok_(paginate_(data.map(publicRow_),query));}catch(e){return fail_(e.message);}
}
function listDeviceOut(token,query){
  try{const s=getSession_(token,true);requirePermission_(s,'deviceout.view');let data=rows_(APP.SHEETS.DEVICE_OUT);query=query||{};if(query.search){const q=lower_(query.search);data=data.filter(r=>JSON.stringify(r).toLowerCase().includes(q));}data.sort((a,b)=>new Date(b.TanggalKeluar)-new Date(a.TanggalKeluar));return ok_(paginate_(data.map(publicRow_),query));}catch(e){return fail_(e.message);}
}
