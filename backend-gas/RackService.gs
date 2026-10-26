function listRacks(token, query) {
  try {
    const s = getSession_(token, true); requirePermission_(s, 'racks.view');
    query = query || {};
    let data = rows_(APP.SHEETS.RACKS).filter(x => !truthy_(x.IsDeleted));
    if (query.search) { const q = lower_(query.search); data = data.filter(r=>JSON.stringify(r).toLowerCase().includes(q)); }
    if (query.site) data = data.filter(r=>upper_(r.SiteCode)===upper_(query.site));
    data.sort((a,b)=>compareValues_(a.SiteCode+a.KodeRack,b.SiteCode+b.KodeRack,'asc'));
    return ok_(paginate_(data.map(publicRow_), query));
  } catch(e){ return fail_(e.message); }
}

function saveRack(token, payload) {
  try {
    const s = getSession_(token, true); payload=cleanObject_(payload||{});
    const isEdit=!!payload.RackID; requirePermission_(s,isEdit?'racks.update':'racks.create');
    assertRequired_(payload,['KodeRack','SiteCode','JumlahRackUnit','Status']);
    const site=findBy_(APP.SHEETS.SITES,'KodeSite',payload.SiteCode,true);
    if(!site || truthy_(site.IsDeleted) || upper_(site.Status)!=='ACTIVE') throw new Error('Site tidak valid.');
    const dup=rows_(APP.SHEETS.RACKS).find(r=>!truthy_(r.IsDeleted)&&upper_(r.SiteCode)===upper_(payload.SiteCode)&&upper_(r.KodeRack)===upper_(payload.KodeRack)&&String(r.RackID)!==String(payload.RackID||''));
    if(dup) throw new Error('Kode Rack sudah ada pada Site tersebut.');
    const data={KodeRack:upper_(payload.KodeRack),SiteCode:upper_(payload.SiteCode),LokasiRack:payload.LokasiRack||'',JumlahRackUnit:payload.JumlahRackUnit,Status:upper_(payload.Status||'ACTIVE'),Keterangan:payload.Keterangan||'',IsDeleted:false,UpdatedAt:now_()};
    if(isEdit){const x=updateById_(APP.SHEETS.RACKS,'RackID',payload.RackID,data);audit_(s,'UPDATE_RACK','RACKS',payload.RackID,data.KodeRack);return ok_(publicRow_(x),'Rack berhasil diperbarui.');}
    data.RackID=uuid_(APP.ID_PREFIX.RACKS);data.CreatedAt=now_();append_(APP.SHEETS.RACKS,data);audit_(s,'CREATE_RACK','RACKS',data.RackID,data.KodeRack);return ok_(publicRow_(data),'Rack berhasil ditambahkan.');
  } catch(e){return fail_(e.message);}
}

function deactivateRack(token,rackId){
  try{const s=getSession_(token,true);requirePermission_(s,'racks.deactivate');updateById_(APP.SHEETS.RACKS,'RackID',rackId,{Status:'INACTIVE',IsDeleted:true,UpdatedAt:now_()});audit_(s,'DEACTIVATE_RACK','RACKS',rackId,'Rack dinonaktifkan');return ok_(null,'Rack berhasil dinonaktifkan.');}
  catch(e){return fail_(e.message);}
}
