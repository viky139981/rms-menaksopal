const state = {
  token: sessionStorage.getItem('mln_token') || '',
  user: null,
  permissions: [],
  master: null,
  page: 'dashboard',
  charts: []
};

let deviceScope = 'DC';

const $ = s => document.querySelector(s);

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

const upper = v => String(v || '').toUpperCase();

function ticketCanView() {
  return can('tickets.view');
}

function ticketCanManage() {
  return can('tickets.manage');
}

function ticketCanDelete() {
  return can('tickets.delete');
}

const can = p => state.permissions.includes('*') || state.permissions.includes(p);

function navItem(page, icon, label) {
  return `
    <a class="nav-item" data-page="${page}" onclick="navigate('${page}')">
      <i class="bi ${icon}"></i><span>${label}</span>
    </a>`;
}

function navSubItem(page, icon, label) {
  return `
    <a class="nav-subitem" data-page="${page}" onclick="navigate('${page}')">
      <i class="bi ${icon}"></i><span>${label}</span>
    </a>`;
}

async function gas(fn, ...args) {
  const response = await fetch('/api/gas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      action: fn,
      args
    })
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (_) {
    throw new Error(
      `API mengembalikan response yang tidak valid (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
      `API request gagal (HTTP ${response.status}).`
    );
  }

  return payload;
}
function toast(msg,type='success'){const el=document.createElement('div');el.className=`toast align-items-center text-bg-${type==='error'?'danger':type} border-0`;el.innerHTML=`<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;$('#toastContainer').appendChild(el);new bootstrap.Toast(el,{delay:3500}).show();el.addEventListener('hidden.bs.toast',()=>el.remove())}
function busy(btn,on){if(!btn)return;btn.disabled=on;if(on){btn.dataset.old=btn.innerHTML;btn.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Memproses...'}else if(btn.dataset.old)btn.innerHTML=btn.dataset.old}
function modal(title,body,footer=''){ $('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalFooter').innerHTML=footer;bootstrap.Modal.getOrCreateInstance($('#appModal')).show()}
function closeModal(){bootstrap.Modal.getOrCreateInstance($('#appModal')).hide()}
function val(id){return document.getElementById(id)?.value??''}
function obj(form){return Object.fromEntries(new FormData(form).entries())}

document.addEventListener('DOMContentLoaded',init);
async function init(){
  $('#loginForm').addEventListener('submit',handleLogin);$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('off');
  if(state.token){const r=await gas('me',state.token).catch(()=>null);if(r?.success){state.user=r.data.user;state.permissions=r.data.permissions;await enterApp();return}else sessionStorage.removeItem('mln_token')}
  showLogin();
}
function showLogin(){
  $('#loginPage').classList.remove('hidden');
  $('#appPage').classList.add('hidden');
  const form=document.getElementById('loginForm');
  if(form) form.reset();
  const u=document.getElementById('loginUsername');
  const p=document.getElementById('loginPassword');
  if(u) u.value='';
  if(p) p.value='';
  setTimeout(()=>u?.focus(),50);
}

async function handleLogin(e){
  e.preventDefault();
  const btn=$('#loginBtn');
  busy(btn,true);
  try{
    const r=await gas('login',val('loginUsername'),val('loginPassword'));
    if(!r?.success) throw new Error(r?.message||'Login gagal.');
    state.token=r.data.token;
    state.user=r.data.user;
    state.permissions=r.data.permissions||[];
    sessionStorage.setItem('mln_token',state.token);
    await enterApp();
  }catch(e){
    toast(e.message||'Login gagal.','error');
  }finally{
    busy(btn,false);
  }
}

async function enterApp() {
  try {
    $('#loginPage').classList.add('hidden');
    $('#appPage').classList.remove('hidden');
    const displayName = state.user?.Nama || state.user?.Username || '';
    $('#userLabel').textContent = displayName;

    const roleEl = document.getElementById('userRole');
    if (roleEl) roleEl.textContent = state.user?.Role || '';

    const initialEl = document.getElementById('userInitial');
    if (initialEl) {
      initialEl.textContent = String(displayName || 'U')
        .trim()
        .charAt(0)
        .toUpperCase();
    }

    buildNav();
    await loadMaster();
    await navigate('dashboard');
    if (state.user?.MustChangePassword) openChangePassword();
  } catch (e) {
    console.error('enterApp ERROR:', e);
    $('#loginPage').classList.add('hidden');
    $('#appPage').classList.remove('hidden');
    $('#content').innerHTML = errorCard('Aplikasi gagal dimuat setelah login', e.message || 'Terjadi kesalahan.');
  }
}
async function logoutApp(){
  const token=state.token;
  try{
    if(token) await gas('logout',token);
  }catch(e){
    console.warn('Logout backend:',e);
  }finally{
    sessionStorage.removeItem('mln_token');
    state.token='';
    state.user=null;
    state.permissions=[];
    state.master=null;
    state.page='dashboard';
    state.charts.forEach(c=>{try{c.destroy()}catch(_){}});
    state.charts=[];
    document.getElementById('nav').innerHTML='';
    document.getElementById('content').innerHTML='';
    document.getElementById('userLabel').textContent='';

    const roleEl=document.getElementById('userRole');
    if(roleEl) roleEl.textContent='';

    const initialEl=document.getElementById('userInitial');
    if(initialEl) initialEl.textContent='U';

    const searchEl=document.getElementById('topGlobalSearch');
    if(searchEl) searchEl.value='';

    const modalEl=document.getElementById('appModal');
    if(modalEl){
      const instance=bootstrap.Modal.getInstance(modalEl);
      if(instance) instance.hide();
    }
    document.querySelectorAll('.modal-backdrop').forEach(x=>x.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    showLogin();
    toast('Logout berhasil.');
  }
}

async function loadMaster(){const r=await gas('getMasterData',state.token);err(r);state.master=r.data;return state.master}

function buildNav() {
  const item = (page, icon, label, permission) => {
    if (!can(permission)) return '';

    return `
      <a
        class="nav-item"
        data-page="${page}"
        onclick="navigate('${page}')"
      >
        <i class="bi ${icon}"></i>
        <span>${label}</span>
      </a>
    `;
  };

  let html = `
    <div class="nav-section">
      MENU UTAMA
    </div>

    ${item(
      'dashboard',
      'bi-house-door',
      'Dashboard',
      'dashboard.view'
    )}

    ${item(
      'letters',
      'bi-envelope',
      'Nomor Surat',
      'letters.view'
    )}
  `;

  if (can('devices.view')) {
    html += `
      <a
        id="deviceMenuParent"
        class="nav-item nav-parent"
        href="javascript:void(0)"
        onclick="toggleDeviceMenu()"
      >
        <i class="bi bi-cpu"></i>

        <span class="flex-grow-1">
          Device Management
        </span>

        <i
          id="deviceMenuIcon"
          class="bi bi-chevron-down nav-chevron"
        ></i>
      </a>

      <div id="deviceSubMenu">
        <a
          class="nav-item device-sub"
          data-page="devices-dc"
          onclick="navigate('devices-dc')"
        >
          <i class="bi bi-server"></i>
          <span>Device Data Center</span>
        </a>

        <a
          class="nav-item device-sub"
          data-page="devices-site"
          onclick="navigate('devices-site')"
        >
          <i class="bi bi-hdd-network"></i>
          <span>Device Site / POP</span>
        </a>
      </div>
    `;
  }

  html += `
    ${item(
      'sites',
      'bi-building',
      'Site & Data Center',
      'sites.view'
    )}

    ${item(
      'permits',
      'bi-file-earmark-text',
      'Data Center Permit',
      'permits.view'
    )}

    ${ticketCanView() ? `
      <div class="nav-section nav-section-spaced">
        OPERASIONAL NOC
      </div>

      <a
        class="nav-item"
        data-page="tickets"
        onclick="navigate('tickets')"
      >
        <i class="bi bi-ticket-detailed"></i>
        <span>Tiket Gangguan</span>
      </a>
    ` : ''}

    <div class="nav-section nav-section-spaced">
      LOGISTIK & ALUR
    </div>

    ${item(
      'devicein',
      'bi-download',
      'Device IN',
      'devicein.view'
    )}

    ${item(
      'deviceout',
      'bi-upload',
      'Device OUT',
      'deviceout.view'
    )}

    ${item(
      'movements',
      'bi-arrow-left-right',
      'Movement History',
      'movements.view'
    )}

    <div class="nav-section nav-section-spaced">
      SISTEM & AKSES
    </div>

    ${item(
      'users',
      'bi-people',
      'Users',
      'users.view'
    )}

    ${item(
      'audit',
      'bi-clipboard-data',
      'Audit Log',
      'audit.view'
    )}

    ${item(
      'settings',
      'bi-gear',
      'Settings',
      'settings.view'
    )}
  `;

  $('#nav').innerHTML = html;
}


async function submitTopSearch() {
  const input = document.getElementById('topGlobalSearch');
  const query = String(input?.value || '').trim();

  if (!query) {
    input?.focus();
    return;
  }

  try {
    const [dcResult, siteResult] = await Promise.all([
      gas('listDevices', state.token, {
        page: 1,
        pageSize: 30,
        search: query,
        scope: 'DC'
      }),
      gas('listDevices', state.token, {
        page: 1,
        pageSize: 30,
        search: query,
        scope: 'SITE'
      })
    ]);

    const devices = [
      ...(dcResult?.success ? (dcResult.data?.rows || []) : []),
      ...(siteResult?.success ? (siteResult.data?.rows || []) : [])
    ];

    const q = query.toLowerCase();

    const sites = (state.master?.sites || [])
      .filter(site =>
        [
          site.KodeSite,
          site.NamaSite,
          site.NamaKota,
          site.TipeSite,
          site.Alamat
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 20);

    const deviceRows = devices.slice(0, 30).map(d => `
      <tr>
        <td>
          <strong>${esc(d.NamaDevice || '-')}</strong>
          <br>
          <small class="text-secondary">${esc(d.JenisDevice || '-')}</small>
        </td>
        <td>${esc(d.SiteCode || '-')}</td>
        <td>${d.IPAddress ? `<code>${esc(d.IPAddress)}</code>` : '-'}</td>
        <td>${badge(d.StatusDevice)}</td>
      </tr>
    `).join('');

    const siteRows = sites.map(s => `
      <tr>
        <td><strong>${esc(s.KodeSite || '-')}</strong></td>
        <td>${esc(s.NamaSite || '-')}</td>
        <td>${esc(s.NamaKota || '-')}</td>
        <td>${esc(s.TipeSite || '-')}</td>
      </tr>
    `).join('');

    modal(
      `Hasil Pencarian: ${query}`,
      `
        <div class="global-search-result">
          <div class="search-result-section">
            <div class="search-result-head">
              <strong>Device</strong>
              <span>${devices.length} hasil</span>
            </div>
            ${table(
              ['Device', 'Site', 'IP Management', 'Status'],
              deviceRows
            )}
          </div>

          <div class="search-result-section mt-3">
            <div class="search-result-head">
              <strong>Site / Data Center</strong>
              <span>${sites.length} hasil</span>
            </div>
            ${table(
              ['Kode Site', 'Nama Site', 'Kota', 'Tipe'],
              siteRows
            )}
          </div>
        </div>
      `,
      `
        <button
          class="btn btn-light"
          data-bs-dismiss="modal"
        >
          Tutup
        </button>
      `
    );

  } catch (e) {
    toast(
      e.message || 'Pencarian gagal.',
      'error'
    );
  }
}


document.addEventListener('keydown', e => {
  if (
    (e.ctrlKey || e.metaKey) &&
    String(e.key).toLowerCase() === 'k'
  ) {
    e.preventDefault();

    const input =
      document.getElementById('topGlobalSearch');

    input?.focus();
    input?.select();
  }
});


function toggleDeviceMenu() {

  const menu =
    document.getElementById(
      'deviceSubMenu'
    );

  const icon =
    document.getElementById(
      'deviceMenuIcon'
    );


  if (!menu) return;


  menu.classList.toggle(
    'hidden'
  );


  if (icon) {

    icon.className =
      menu.classList.contains('hidden')
        ? 'bi bi-chevron-right'
        : 'bi bi-chevron-down';

  }
}

function setTitle(t,s=''){ $('#topTitle').textContent=t;$('#topSub').textContent=s;document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.page===state.page))}

async function navigate(page) {
  state.page = page;

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const deviceParent = document.getElementById('deviceMenuParent');
  if (deviceParent) {
    deviceParent.classList.toggle('active', page === 'devices-dc' || page === 'devices-site');
  }

  if (window.innerWidth < 992) {
    document.getElementById('sidebar')?.classList.add('off');
  }

  try {
    switch (page) {
      case 'dashboard': await renderDashboard(); break;
      case 'letters': await renderLetters(); break;
      case 'devices-dc': deviceScope = 'DC'; await renderDevices(1); break;
      case 'devices-site': deviceScope = 'SITE'; await renderDevices(1); break;
      case 'sites': await renderSites(); break;
      case 'racks': await renderRacks(); break;
      case 'permits': await renderPermits(); break;
      case 'devicein': await renderDeviceIn(); break;
      case 'deviceout': await renderDeviceOut(); break;
      case 'movements': await renderMovements(); break;
      case 'tickets': await renderTickets(1); break;
      case 'users': await renderUsers(); break;
      case 'audit': await renderAudit(); break;
      case 'settings': await renderSettings(); break;
      default: throw new Error('Route tidak ditemukan: ' + page);
    }
  } catch (e) {
    console.error('navigate ERROR:', page, e);
    $('#content').innerHTML = errorCard('Halaman gagal dimuat', e.message || 'Terjadi kesalahan.');
    toast(e.message || 'Halaman gagal dimuat.', 'error');
  }
}

async function renderDevices(page = 1) {
  const isDC = deviceScope === 'DC';

  const title = isDC
    ? 'Device Data Center'
    : 'Device Site / POP';

  const subtitle = isDC
    ? 'Perangkat dikelompokkan berdasarkan Kota → Data Center → Device'
    : 'Perangkat dikelompokkan berdasarkan Kota → Site / POP → Device';

  setTitle(title, subtitle);
  loading();

  try {
    /*
     * Ambil semua device untuk scope aktif.
     * Grouping dilakukan dari master SITES:
     * NamaKota -> KodeSite -> DEVICES.SiteCode
     */
    const r = await gas(
      'listDevices',
      state.token,
      {
        page: 1,
        pageSize: 5000,
        scope: deviceScope
      }
    );

    err(r);

    const allDevices = r.data?.rows || [];
    window.deviceRows = allDevices;

    const allSites = state.master?.sites || [];

    const scopeSites = allSites.filter(site => {
      const type = String(
        site.TipeSite || ''
      ).toUpperCase();

      return isDC
        ? type === 'DATA CENTER'
        : type !== 'DATA CENTER';
    });

    const siteMap = new Map(
      scopeSites.map(site => [
        String(site.KodeSite || ''),
        site
      ])
    );

    /*
     * Pastikan device yang SiteCode-nya sudah tidak ada di master
     * tetap dapat terlihat dan tidak hilang dari tampilan.
     */
    allDevices.forEach(device => {
      const code = String(
        device.SiteCode || ''
      ).trim();

      if (code && !siteMap.has(code)) {
        siteMap.set(
          code,
          {
            KodeSite: code,
            NamaSite: 'Site tidak ditemukan di master',
            NamaKota: '',
            TipeSite: isDC
              ? 'Data Center'
              : 'Site / POP',
            Status: 'INACTIVE'
          }
        );
      }
    });

    const search = String(
      window.deviceSearch || ''
    ).trim().toLowerCase();

    const cityMap = new Map();

    Array.from(siteMap.values())
      .forEach(site => {
        const code = String(
          site.KodeSite || ''
        );

        const resolved =
          typeof resolveSiteCity === 'function'
            ? resolveSiteCity(site)
            : {
                city:
                  String(site.NamaKota || '').trim() ||
                  'Belum Ditentukan'
              };

        const city =
          resolved.city ||
          'Belum Ditentukan';

        const allSiteDevices =
          allDevices.filter(device =>
            String(device.SiteCode || '') === code
          );

        const siteMetaText = [
          city,
          site.KodeSite,
          site.NamaSite,
          site.NamaKota,
          site.TipeSite,
          site.PICKoordinator,
          site.Alamat
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const siteMatches =
          !search ||
          siteMetaText.includes(search);

        const matchingDevices =
          !search
            ? allSiteDevices
            : allSiteDevices.filter(device =>
                JSON.stringify(device)
                  .toLowerCase()
                  .includes(search)
              );

        /*
         * Jika kata pencarian cocok dengan Kota/Site,
         * tampilkan seluruh device milik Site tersebut.
         * Jika hanya cocok dengan data device,
         * tampilkan device yang cocok saja.
         */
        const visibleDevices =
          siteMatches
            ? allSiteDevices
            : matchingDevices;

        if (
          search &&
          !siteMatches &&
          !matchingDevices.length
        ) {
          return;
        }

        const cityKey =
          city.toUpperCase();

        if (!cityMap.has(cityKey)) {
          cityMap.set(
            cityKey,
            {
              city,
              sites: []
            }
          );
        }

        cityMap
          .get(cityKey)
          .sites
          .push({
            site,
            devices: visibleDevices,
            totalDevices:
              allSiteDevices.length
          });
      });

    const cityGroups =
      Array.from(cityMap.values());

    cityGroups.forEach(group => {
      group.sites.sort((a, b) =>
        String(a.site.KodeSite || '')
          .localeCompare(
            String(b.site.KodeSite || ''),
            'id',
            { sensitivity: 'base' }
          )
      );
    });

    cityGroups.sort((a, b) => {
      if (a.city === 'Belum Ditentukan') {
        return 1;
      }

      if (b.city === 'Belum Ditentukan') {
        return -1;
      }

      return a.city.localeCompare(
        b.city,
        'id',
        { sensitivity: 'base' }
      );
    });

    const totalLocations =
      cityGroups.reduce(
        (sum, group) =>
          sum + group.sites.length,
        0
      );

    const totalDevices =
      cityGroups.reduce(
        (sum, group) =>
          sum +
          group.sites.reduce(
            (siteSum, x) =>
              siteSum +
              x.totalDevices,
            0
          ),
        0
      );

    $('#content').innerHTML = `
      <div class="toolbar mb-3">
        <div>
          <h1 class="page-title">
            ${title}
          </h1>

          <div class="page-sub">
            ${subtitle}
          </div>
        </div>

        ${can('devices.create') ? `
          <button
            class="btn btn-primary"
            onclick="openDeviceForm('', '${deviceScope}')"
          >
            <i class="bi bi-plus-lg me-1"></i>
            Tambah Device
          </button>
        ` : ''}
      </div>

      <div class="device-summary-strip mb-3">
        <div>
          <span class="device-summary-label">
            ${isDC
              ? 'Data Center'
              : 'Site / POP'}
          </span>

          <strong>
            ${totalLocations}
          </strong>
        </div>

        <div>
          <span class="device-summary-label">
            Total Device
          </span>

          <strong>
            ${totalDevices}
          </strong>
        </div>

        <div>
          <span class="device-summary-label">
            Kota
          </span>

          <strong>
            ${cityGroups.length}
          </strong>
        </div>
      </div>

      <div class="cardx device-management-card">
        <div class="toolbar mb-3">
          <div class="left">
            <input
              id="deviceSearch"
              class="form-control"
              placeholder="Cari kota, kode site, device, SN, IP, port..."
              value="${esc(window.deviceSearch || '')}"
              onkeydown="
                if(event.key === 'Enter') {
                  saveDeviceSearch()
                }
              "
            >

            <button
              class="btn btn-light"
              onclick="saveDeviceSearch()"
            >
              <i class="bi bi-search me-1"></i>
              Cari
            </button>

            ${window.deviceSearch ? `
              <button
                class="btn btn-light"
                onclick="clearDeviceSearch()"
                title="Reset pencarian"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            ` : ''}
          </div>

          <div class="device-group-hint">
            <i class="bi bi-info-circle me-1"></i>
            Klik Kota, lalu klik Site / Data Center untuk melihat Device.
          </div>
        </div>

        ${cityGroups.length ? `
          <div class="device-city-list">
            ${cityGroups
              .map(
                (group, cityIndex) =>
                  renderDeviceCityGroup(
                    group,
                    cityIndex,
                    isDC
                  )
              )
              .join('')}
          </div>
        ` : `
          <div class="device-empty-state">
            <i class="bi bi-hdd-network"></i>

            <strong>
              Data perangkat tidak ditemukan
            </strong>

            <span>
              ${window.deviceSearch
                ? 'Tidak ada Kota, Site, atau Device yang sesuai dengan pencarian.'
                : 'Belum ada data perangkat pada kategori ini.'}
            </span>
          </div>
        `}
      </div>
    `;

  } catch (e) {
    console.error(
      'renderDevices ERROR:',
      e
    );

    $('#content').innerHTML =
      errorCard(
        'Device gagal dimuat',
        e.message ||
        'Terjadi kesalahan.'
      );

    toast(
      e.message ||
      'Device gagal dimuat.',
      'error'
    );
  }
}


function renderDeviceCityGroup(
  group,
  cityIndex,
  isDC
) {
  const cityBodyId =
    `deviceCityBody_${cityIndex}`;

  const locationLabel =
    isDC
      ? 'Data Center'
      : 'POP';

  const locationCount =
    group.sites.length;

  const cityDeviceCount =
    group.sites.reduce(
      (sum, x) =>
        sum + x.totalDevices,
      0
    );

  return `
    <section class="device-city-group">

      <button
        type="button"
        class="device-city-toggle"
        onclick="
          toggleDeviceCityGroup(
            '${cityBodyId}',
            this
          )
        "
        aria-expanded="false"
      >
        <div class="device-city-main">
          <span class="device-city-icon">
            <i class="bi bi-geo-alt-fill"></i>
          </span>

          <span class="device-city-copy">
            <strong>
              ${esc(group.city)}
            </strong>

            <small>
              ${cityDeviceCount} Device terdaftar
            </small>
          </span>
        </div>

        <div class="device-city-meta">
          <span class="device-location-count">
            ${locationCount}
            ${locationLabel}
          </span>

          <span class="device-city-chevron">
            <i class="bi bi-chevron-down"></i>
          </span>
        </div>
      </button>

      <div
        id="${cityBodyId}"
        class="device-city-body hidden"
      >
        <div class="device-location-list">

          ${group.sites
            .map(
              (entry, siteIndex) =>
                renderDeviceLocationGroup(
                  entry,
                  cityIndex,
                  siteIndex,
                  isDC
                )
            )
            .join('')}

        </div>
      </div>
    </section>
  `;
}


function renderDeviceLocationGroup(
  entry,
  cityIndex,
  siteIndex,
  isDC
) {
  const site = entry.site;
  const devices = entry.devices || [];

  const siteBodyId =
    `deviceLocationBody_${cityIndex}_${siteIndex}`;

  const locationIcon =
    isDC
      ? 'bi-building'
      : 'bi-diagram-3';

  return `
    <section class="device-location-group">

      <button
        type="button"
        class="device-location-toggle"
        onclick="
          toggleDeviceLocationGroup(
            '${siteBodyId}',
            this
          )
        "
        aria-expanded="false"
      >
        <div class="device-location-main">
          <span class="device-location-icon">
            <i class="bi ${locationIcon}"></i>
          </span>

          <span class="device-location-copy">
            <strong>
              ${esc(site.KodeSite || '-')}
            </strong>

            <small>
              ${esc(site.NamaSite || '-')}
            </small>
          </span>
        </div>

        <div class="device-location-meta">
          <span class="device-count-badge">
            ${entry.totalDevices}
            Device
          </span>

          <span class="device-location-chevron">
            <i class="bi bi-chevron-down"></i>
          </span>
        </div>
      </button>

      <div
        id="${siteBodyId}"
        class="device-location-body hidden"
      >
        ${renderDeviceGroupTable(devices)}
      </div>

    </section>
  `;
}


function renderDeviceGroupTable(rows) {
  return table(
    [
      'Device',
      'Brand / Type',
      'Serial Number',
      'IP Management',
      'Port Access',
      'Rack',
      'Rack Unit',
      'Lokasi Detail',
      'Status',
      'Action'
    ],

    (rows || [])
      .map(x => deviceGroupRow(x))
      .join('')
  );
}


function deviceGroupRow(x) {
  const rackText = x.RackCode
    ? `
      <strong>
        ${esc(x.RackCode)}
      </strong>
    `
    : '<span class="text-secondary">-</span>';

  return `
    <tr>

      <td>
        <strong>
          ${esc(x.NamaDevice || '-')}
        </strong>

        <br>

        <small class="text-secondary">
          ${esc(x.JenisDevice || '-')}
        </small>
      </td>

      <td>
        <strong>
          ${esc(x.Brand || '-')}
        </strong>

        <br>

        <small class="text-secondary">
          ${esc(x.TipeDevice || '-')}
        </small>
      </td>

      <td>
        ${x.SerialNumber
          ? esc(x.SerialNumber)
          : '<span class="text-secondary">-</span>'}
      </td>

      <td>
        ${x.IPAddress
          ? `<code>${esc(x.IPAddress)}</code>`
          : '<span class="text-secondary">-</span>'}
      </td>

      <td>
        ${x.Port
          ? `<code>${esc(x.Port)}</code>`
          : '<span class="text-secondary">-</span>'}
      </td>

      <td>
        ${rackText}
      </td>

      <td>
        ${x.RackUnit
          ? esc(x.RackUnit)
          : '<span class="text-secondary">-</span>'}
      </td>

      <td>
        ${x.LokasiDevice
          ? `
            <i class="bi bi-geo-alt me-1 text-secondary"></i>
            ${esc(x.LokasiDevice)}
          `
          : '<span class="text-secondary">-</span>'}
      </td>

      <td>
        ${badge(x.StatusDevice)}
      </td>

      <td>
        <div class="d-flex gap-1">

          ${can('devices.update') ? `
            <button
              class="btn btn-sm btn-light"
              onclick="
                openDeviceForm(
                  '${x.DeviceID}',
                  '${deviceScope}'
                )
              "
              title="Edit Device"
            >
              <i class="bi bi-pencil"></i>
            </button>
          ` : ''}

          <button
            class="btn btn-sm btn-light"
            onclick="showHistory('${x.DeviceID}')"
            title="Movement History"
          >
            <i class="bi bi-clock-history"></i>
          </button>

          ${can('devices.deactivate') ? `
            <button
              class="btn btn-sm btn-outline-danger"
              onclick="deleteDeviceUI('${x.DeviceID}')"
              title="Hapus Device"
            >
              <i class="bi bi-trash"></i>
            </button>
          ` : ''}

        </div>
      </td>

    </tr>
  `;
}


function toggleDeviceCityGroup(
  bodyId,
  button
) {
  const body =
    document.getElementById(bodyId);

  if (!body) return;

  const willOpen =
    body.classList.contains('hidden');

  body.classList.toggle(
    'hidden',
    !willOpen
  );

  button?.classList.toggle(
    'open',
    willOpen
  );

  button?.setAttribute(
    'aria-expanded',
    willOpen
      ? 'true'
      : 'false'
  );

  const icon =
    button?.querySelector(
      '.device-city-chevron i'
    );

  if (icon) {
    icon.className =
      willOpen
        ? 'bi bi-chevron-up'
        : 'bi bi-chevron-down';
  }

  /*
   * Saat Kota ditutup, semua Site di dalamnya
   * ikut dikembalikan ke kondisi tertutup.
   */
  if (!willOpen) {
    body
      .querySelectorAll(
        '.device-location-body'
      )
      .forEach(el =>
        el.classList.add('hidden')
      );

    body
      .querySelectorAll(
        '.device-location-toggle'
      )
      .forEach(btn => {
        btn.classList.remove('open');

        btn.setAttribute(
          'aria-expanded',
          'false'
        );

        const nestedIcon =
          btn.querySelector(
            '.device-location-chevron i'
          );

        if (nestedIcon) {
          nestedIcon.className =
            'bi bi-chevron-down';
        }
      });
  }
}


function toggleDeviceLocationGroup(
  bodyId,
  button
) {
  const body =
    document.getElementById(bodyId);

  if (!body) return;

  const willOpen =
    body.classList.contains('hidden');

  body.classList.toggle(
    'hidden',
    !willOpen
  );

  button?.classList.toggle(
    'open',
    willOpen
  );

  button?.setAttribute(
    'aria-expanded',
    willOpen
      ? 'true'
      : 'false'
  );

  const icon =
    button?.querySelector(
      '.device-location-chevron i'
    );

  if (icon) {
    icon.className =
      willOpen
        ? 'bi bi-chevron-up'
        : 'bi bi-chevron-down';
  }
}


function saveDeviceSearch() {
  window.deviceSearch =
    val('deviceSearch').trim();

  renderDevices(1);
}


function clearDeviceSearch() {
  window.deviceSearch = '';

  renderDevices(1);
}


async function deleteDeviceUI(deviceId) {
  const device =
    (window.deviceRows || [])
      .find(x =>
        String(x.DeviceID) ===
        String(deviceId)
      );

  const nama =
    device?.NamaDevice ||
    deviceId;

  const site =
    device?.SiteCode
      ? `\nSite: ${device.SiteCode}`
      : '';

  const confirmed = confirm(
    `Hapus Device "${nama}"?` +
    site +
    `\n\nDevice akan dinonaktifkan (soft delete). ` +
    `Histori perangkat tetap disimpan.`
  );

  if (!confirmed) return;

  try {
    const r = await gas(
      'deactivateDevice',
      state.token,
      deviceId
    );

    if (!r?.success) {
      throw new Error(
        r?.message ||
        'Gagal menghapus Device.'
      );
    }

    toast(
      r.message ||
      'Device berhasil dihapus.'
    );

    await renderDevices(1);

  } catch (e) {
    toast(
      e.message ||
      'Gagal menghapus Device.',
      'error'
    );
  }
}


function loading(){ $('#content').innerHTML='<div class="py-5 text-center"><div class="spinner-border text-primary"></div></div>'}
function err(r){if(!r?.success)throw new Error(r?.message||'Terjadi kesalahan')}
function badge(v){const u=String(v||'').toUpperCase();let c='';if(['ACTIVE','APPROVED','CONFIRMED','COMPLETED'].includes(u))c='success';else if(['PENDING','MAINTENANCE','SPARE','DRAFT'].includes(u))c='warning';else if(['REJECTED','RUSAK','KELUAR','DECOMMISSIONED','INACTIVE'].includes(u))c='danger';return `<span class="badge-soft ${c}">${esc(v)}</span>`}
function table(headers,rows){return `<div class="table-responsive"><table class="table table-hover"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="text-center text-secondary py-4">Belum ada data</td></tr>`}</tbody></table></div>`}
function pager(data,callback){if(!data||data.totalPages<=1)return'';return `<div class="d-flex justify-content-between align-items-center mt-3"><small class="text-secondary">${data.total} data</small><div><button class="btn btn-sm btn-light" ${data.page<=1?'disabled':''} onclick="${callback}(${data.page-1})">‹</button><span class="mx-2 small">${data.page}/${data.totalPages}</span><button class="btn btn-sm btn-light" ${data.page>=data.totalPages?'disabled':''} onclick="${callback}(${data.page+1})">›</button></div></div>`}

function errorCard(title,message){return `<div class="cardx"><div class="d-flex gap-3 align-items-start"><div class="text-danger fs-3"><i class="bi bi-exclamation-triangle"></i></div><div><h5>${esc(title)}</h5><div class="text-secondary">${esc(message||'Terjadi kesalahan.')}</div></div></div></div>`}

async function renderDashboard(){
  setTitle('OVERVIEW','Performance at a Glance');
  loading();

  try{
    const r = await gas(
      'getDashboardSummary',
      state.token
    );

    err(r);

    const d = r.data || {};

    const typeLabels =
      Object.keys(
        d.devicesByType || {}
      );

    const typeValues =
      Object.values(
        d.devicesByType || {}
      );

    const siteLabels =
      Object.keys(
        d.devicesBySite || {}
      );

    const siteValues =
      Object.values(
        d.devicesBySite || {}
      );

    const updated =
      new Intl.DateTimeFormat(
        'id-ID',
        {
          day:'2-digit',
          month:'short',
          year:'numeric',
          hour:'2-digit',
          minute:'2-digit',
          hour12:false
        }
      ).format(new Date());

    const statCards = [
      [
        'TOTAL DEVICE',
        d.totalDevices || 0,
        'bi-cpu',
        'stat-blue',
        'Seluruh perangkat'
      ],
      [
        'DEVICE DATA CENTER',
        d.devicesInDataCenter || 0,
        'bi-server',
        'stat-green',
        'Perangkat di Data Center'
      ],
      [
        'DATA CENTER',
        d.totalDataCenters || 0,
        'bi-building',
        'stat-purple',
        'Lokasi Data Center'
      ],
      [
        'RACK AKTIF',
        d.totalRacks || 0,
        'bi-database',
        'stat-orange',
        'Rack tersedia'
      ],
      [
        'PERMIT PENDING',
        d.pendingPermits || 0,
        'bi-file-earmark-text',
        'stat-cyan',
        'Menunggu approval'
      ]
    ];

    const typeTotal =
      typeValues.reduce(
        (sum, value) =>
          sum + Number(value || 0),
        0
      );

    const typePalette = [
      '#00d9e8',
      '#ff4567',
      '#ff7a1a',
      '#ffd21f',
      '#7d6cff',
      '#28d99a',
      '#45a6ff',
      '#e169ff'
    ];

    const typeLegend =
      typeLabels.map(
        (label, index) => `
          <div class="dash-legend-row">
            <span
              class="dash-legend-dot"
              style="
                --legend-color:
                ${typePalette[
                  index % typePalette.length
                ]}
              "
            ></span>

            <span class="dash-legend-name">
              ${esc(label)}
            </span>

            <strong>
              ${Number(
                typeValues[index] || 0
              )}
            </strong>
          </div>
        `
      ).join('');

    const rankedSites =
      siteLabels
        .map((label, index) => ({
          label,
          value:
            Number(
              siteValues[index] || 0
            )
        }))
        .sort(
          (a, b) =>
            b.value - a.value
        );

    const topSiteText =
      rankedSites.length
        ? rankedSites
            .slice(0, 2)
            .map(x => x.label)
            .join(' & ')
        : '-';

    $('#content').innerHTML = `
      <div class="overview-head">
        <div>
          <div class="overview-title-row">
            <h1 class="page-title">
              OVERVIEW
            </h1>

            <span class="overview-chip">
              Performance at a Glance
            </span>
          </div>

          <div class="page-sub">
            Ringkasan operasional PT Menaksopal Link Nusantara
          </div>
        </div>

        <div class="overview-meta">
          <span class="live-dot"></span>
          <i class="bi bi-clock"></i>
          <span>
            Update ${esc(updated)}
          </span>
        </div>
      </div>

      <div class="dashboard-kpis">
        ${statCards.map(
          (
            [
              label,
              value,
              icon,
              cls,
              note
            ]
          ) => `
            <article
              class="stat-card ${cls}"
            >
              <div class="stat-card-top">
                <div class="stat-label">
                  ${label}
                </div>

                <div class="stat-icon">
                  <i class="bi ${icon}"></i>
                </div>
              </div>

              <div class="stat-value">
                ${value}
              </div>

              <div class="stat-note">
                ${note}
              </div>
            </article>
          `
        ).join('')}
      </div>

      <div class="dashboard-mini-grid">
        <div class="mini-stat mini-cyan">
          <span class="mini-icon">
            <i class="bi bi-download"></i>
          </span>

          <div>
            <b>
              ${d.deviceInThisMonth || 0}
            </b>

            <small>
              Device IN bulan ini
            </small>
          </div>
        </div>

        <div class="mini-stat mini-violet">
          <span class="mini-icon">
            <i class="bi bi-upload"></i>
          </span>

          <div>
            <b>
              ${d.deviceOutThisMonth || 0}
            </b>

            <small>
              Device OUT bulan ini
            </small>
          </div>
        </div>

        <div class="mini-stat mini-teal">
          <span class="mini-icon">
            <i class="bi bi-hdd-network"></i>
          </span>

          <div>
            <b>
              ${siteLabels.length}
            </b>

            <small>
              Site memiliki device
            </small>
          </div>
        </div>
      </div>

      <div class="dashboard-grid-main">
        <section class="dashboard-panel dashboard-type-panel">
          <div class="panel-head">
            <div>
              <h6>DEVICE SUMMARY</h6>
              <small>
                Distribusi berdasarkan jenis perangkat
              </small>
            </div>

            <i class="bi bi-pie-chart"></i>
          </div>

          <div class="device-summary-layout">
            <div class="donut-shell">
              <canvas id="chartType"></canvas>

              <div class="donut-center">
                <strong>
                  ${typeTotal}
                </strong>

                <span>
                  PERANGKAT
                </span>
              </div>
            </div>

            <div class="dash-legend">
              ${typeLegend || `
                <div class="text-secondary small">
                  Belum ada data perangkat.
                </div>
              `}
            </div>
          </div>

          <div class="panel-footer">
            <span>
              Kategori terdaftar:
              <strong>
                ${typeLabels.length} tipe
              </strong>
            </span>

            <button
              type="button"
              onclick="navigate('devices-site')"
            >
              Kelola Kategori
              <i class="bi bi-arrow-right"></i>
            </button>
          </div>
        </section>

        <section class="dashboard-panel dashboard-site-panel">
          <div class="panel-head">
            <div>
              <h6>DEVICE BY SITE</h6>
              <small>
                Jumlah perangkat pada setiap lokasi
              </small>
            </div>

            <div class="panel-head-right">
              <span class="panel-count-badge">
                ${siteLabels.length} Sites
              </span>

              <i class="bi bi-bar-chart"></i>
            </div>
          </div>

          <div class="chart-wrap chart-site-wrap">
            <canvas id="chartSite"></canvas>
          </div>

          <div class="panel-footer">
            <span>
              Site dengan beban terbanyak:
              <strong>
                ${esc(topSiteText)}
              </strong>
            </span>

            <button
              type="button"
              onclick="navigate('sites')"
            >
              Detail Semua Site
              <i class="bi bi-arrow-right"></i>
            </button>
          </div>
        </section>
      </div>
    `;

    state.charts.forEach(
      chart => {
        try {
          chart.destroy();
        } catch (_) {}
      }
    );

    state.charts = [];

    if (window.Chart) {
      Chart.defaults.color =
        '#72829a';

      Chart.defaults.borderColor =
        'rgba(76,104,140,.18)';

      state.charts.push(
        new Chart(
          $('#chartType'),
          {
            type:'doughnut',

            data:{
              labels:typeLabels,

              datasets:[{
                data:typeValues,
                borderWidth:0,
                backgroundColor:
                  typeLabels.map(
                    (_, index) =>
                      typePalette[
                        index %
                        typePalette.length
                      ]
                  ),
                hoverOffset:3
              }]
            },

            options:{
              responsive:true,
              maintainAspectRatio:false,
              cutout:'72%',

              plugins:{
                legend:{
                  display:false
                },

                tooltip:{
                  backgroundColor:'#0c1421',
                  borderColor:'#223652',
                  borderWidth:1,
                  titleColor:'#fff',
                  bodyColor:'#b8c6d8',
                  padding:10
                }
              }
            }
          }
        )
      );

      const valueLabelsPlugin = {
        id:'mlnValueLabels',

        afterDatasetsDraw(chart) {
          const {
            ctx
          } = chart;

          const meta =
            chart.getDatasetMeta(0);

          ctx.save();
          ctx.fillStyle =
            '#74e7ff';

          ctx.font =
            '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';

          ctx.textAlign =
            'center';

          ctx.textBaseline =
            'bottom';

          meta.data.forEach(
            (bar, index) => {
              const value =
                Number(
                  chart.data
                    .datasets[0]
                    .data[index] || 0
                );

              if (!value) return;

              ctx.fillText(
                String(value),
                bar.x,
                bar.y - 6
              );
            }
          );

          ctx.restore();
        }
      };

      state.charts.push(
        new Chart(
          $('#chartSite'),
          {
            type:'bar',

            data:{
              labels:siteLabels,

              datasets:[{
                label:'Device',
                data:siteValues,
                borderRadius:4,
                borderSkipped:false,
                maxBarThickness:28,
                backgroundColor:
                  '#14d7e6',
                hoverBackgroundColor:
                  '#47e8f3'
              }]
            },

            plugins:[
              valueLabelsPlugin
            ],

            options:{
              responsive:true,
              maintainAspectRatio:false,

              layout:{
                padding:{
                  top:16
                }
              },

              plugins:{
                legend:{
                  display:false
                },

                tooltip:{
                  backgroundColor:'#0c1421',
                  borderColor:'#223652',
                  borderWidth:1,
                  titleColor:'#fff',
                  bodyColor:'#b8c6d8',
                  padding:10
                }
              },

              scales:{
                x:{
                  grid:{
                    display:false
                  },

                  border:{
                    color:'#263a55'
                  },

                  ticks:{
                    color:'#60718a',
                    font:{
                      size:9,
                      weight:'600'
                    },
                    maxRotation:0,
                    minRotation:0,
                    autoSkip:false
                  }
                },

                y:{
                  beginAtZero:true,

                  border:{
                    display:false
                  },

                  ticks:{
                    precision:0,
                    color:'#53657d',
                    font:{
                      size:9
                    }
                  },

                  grid:{
                    color:
                      'rgba(73,103,140,.22)',
                    borderDash:[
                      3,
                      3
                    ]
                  }
                }
              }
            }
          }
        )
      );
    }

  } catch(e) {
    console.error(
      'renderDashboard:',
      e
    );

    $('#content').innerHTML =
      errorCard(
        'Dashboard gagal dimuat',
        e.message
      );
  }
}


async function renderLetters(page=1){
 setTitle('Nomor Surat','Generate dan histori nomor surat');loading();const q={page,pageSize:20,search:window.letterSearch||''};const r=await gas('listLetters',state.token,q);err(r);const d=r.data;
 $('#content').innerHTML=`<div class="toolbar mb-3"><div><h1 class="page-title">Nomor Surat</h1><div class="page-sub">Nomor otomatis anti-duplikasi</div></div><div class="right">${can('letters.create')?'<button class="btn btn-primary" onclick="openLetterForm()"><i class="bi bi-plus-lg"></i> Generate</button>':''}</div></div>
 <div class="cardx"><div class="toolbar mb-3"><div class="left"><input id="letterSearch" class="form-control" placeholder="Cari surat..." value="${esc(window.letterSearch||'')}"><button class="btn btn-light" onclick="window.letterSearch=val('letterSearch');renderLetters(1)">Cari</button></div></div>
 ${table(['Nomor Surat','Tanggal','Jenis','Tujuan','Perihal','Dibuat Oleh'],d.rows.map(x=>`<tr><td><strong>${esc(x.NomorSurat)}</strong></td><td>${esc(x.TanggalSurat)}</td><td>${esc(x.JenisSurat)}</td><td>${esc(x.TujuanSurat)}</td><td>${esc(x.Perihal)}</td><td>${esc(x.CreatedBy)}</td></tr>`).join(''))}${pager(d,'renderLetters')}</div>`;
}
function openLetterForm() {
  const units = state.master?.units || [];
  const types = state.master?.letterTypes || [];

  modal('Generate Nomor Surat', `
    <form id="letterForm" class="row g-3">
      <div class="col-md-6"><label class="form-label">Tanggal Surat</label><input name="TanggalSurat" type="date" class="form-control" required></div>
      <div class="col-md-6"><label class="form-label">Kode Unit / Divisi</label><div class="input-group">
        <select id="letterUnit" name="KodeUnit" class="form-select" required><option value="">Pilih Unit</option>${units.map(x=>`<option value="${esc(x.KodeUnit)}">${esc(x.KodeUnit)} - ${esc(x.NamaUnit)}</option>`).join('')}</select>
        ${can('master.manage') ? `<button type="button" class="btn btn-outline-primary" onclick="toggleAddUnitLetter()" title="Tambah Kode Unit"><i class="bi bi-plus-lg"></i></button>` : ''}
      </div></div>
      ${can('master.manage') ? `<div id="addUnitLetterBox" class="col-12 d-none"><div class="border rounded-3 p-3 bg-light"><div class="fw-bold mb-2">Tambah Kode Unit Surat</div><div class="row g-2"><div class="col-md-4"><label class="form-label">Kode Unit</label><input id="newLetterUnitCode" class="form-control" maxlength="10" placeholder="Contoh: NOC"></div><div class="col-md-6"><label class="form-label">Nama Unit / Divisi</label><input id="newLetterUnitName" class="form-control" placeholder="Contoh: Network Operation Center"></div><div class="col-md-2 d-flex align-items-end"><button type="button" class="btn btn-success w-100" onclick="saveUnitFromLetter()"><i class="bi bi-check-lg"></i> Simpan</button></div></div></div></div>` : ''}
      <div class="col-md-6"><label class="form-label">Jenis Surat</label><select name="KodeJenis" class="form-select" required><option value="">Pilih Jenis Surat</option>${types.map(x=>`<option value="${esc(x.KodeJenis)}">${esc(x.KodeJenis)} - ${esc(x.NamaJenis)}</option>`).join('')}</select></div>
      <div class="col-md-6"><label class="form-label">Tujuan Surat</label><input name="TujuanSurat" class="form-control" required></div>
      <div class="col-12"><label class="form-label">Perihal</label><input name="Perihal" class="form-control"></div>
    </form>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" onclick="submitLetter()"><i class="bi bi-file-earmark-plus me-1"></i>Generate Nomor</button>`
  );
}

function toggleAddUnitLetter(){document.getElementById('addUnitLetterBox')?.classList.toggle('d-none')}

async function saveUnitFromLetter(){
  const KodeUnit=val('newLetterUnitCode').trim().toUpperCase(), NamaUnit=val('newLetterUnitName').trim();
  if(!KodeUnit||!NamaUnit)return toast('Kode Unit dan Nama Unit wajib diisi.','error');
  const r=await gas('saveMasterItem',state.token,'UNIT',{KodeUnit,NamaUnit,Status:'ACTIVE'});
  if(!r.success)return toast(r.message,'error');
  await loadMaster();
  const select=document.getElementById('letterUnit');
  if(select){select.innerHTML='<option value="">Pilih Unit</option>'+(state.master?.units||[]).map(x=>`<option value="${esc(x.KodeUnit)}">${esc(x.KodeUnit)} - ${esc(x.NamaUnit)}</option>`).join('');select.value=KodeUnit}
  document.getElementById('addUnitLetterBox')?.classList.add('d-none');
  toast('Kode Unit berhasil disimpan.');
}

async function submitLetter(){const f=$('#letterForm');if(!f.reportValidity())return;const r=await gas('generateLetter',state.token,obj(f));if(!r.success)return toast(r.message,'error');toast(`Nomor ${r.data.NomorSurat} berhasil dibuat`);closeModal();renderLetters(1)}

async function renderSites() {
  setTitle('Site & Data Center', 'Master lokasi jaringan berdasarkan kota');
  loading();

  try {
    // Ambil seluruh Site agar data lama yang belum memiliki NamaKota
    // tetap dapat dikelompokkan melalui fallback KodeSite / NamaSite.
    const r = await gas('listSites', state.token, {
      page: 1,
      pageSize: 5000
    });

    err(r);

    const allRows = r.data?.rows || [];
    const search = String(window.siteSearch || '').trim();

    const rows = search
      ? allRows.filter(site => siteMatchesSearch(site, search))
      : allRows;

    window.siteRows = allRows;

    const groups = groupSitesByCity(rows);

    $('#content').innerHTML = `
      <div class="toolbar mb-3">
        <div>
          <h1 class="page-title">Site & Data Center</h1>
          <div class="page-sub">
            Site dan Data Center dikelompokkan berdasarkan Nama Kota
          </div>
        </div>

        ${can('sites.create') ? `
          <button class="btn btn-primary" onclick="openSiteForm()">
            <i class="bi bi-plus-lg me-1"></i>
            Tambah Site
          </button>
        ` : ''}
      </div>

      <div class="cardx site-management-card">
        <div class="toolbar mb-3">
          <div class="left">
            <input
              id="siteSearch"
              class="form-control"
              placeholder="Cari kota, kode site, nama site, PIC, alamat..."
              value="${esc(window.siteSearch || '')}"
              onkeydown="if(event.key==='Enter') saveSiteSearch()"
            >

            <button class="btn btn-light" onclick="saveSiteSearch()">
              <i class="bi bi-search me-1"></i>
              Cari
            </button>

            ${window.siteSearch ? `
              <button
                class="btn btn-light"
                onclick="clearSiteSearch()"
                title="Reset pencarian"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            ` : ''}
          </div>

          <div class="site-group-hint">
            <i class="bi bi-chevron-down me-1"></i>
            Klik kota untuk melihat seluruh Site / Data Center
          </div>
        </div>

        ${groups.length ? `
          <div class="site-group-list">
            ${groups
              .map((group, index) => renderSiteCityGroup(group, index))
              .join('')}
          </div>
        ` : `
          <div class="site-empty-state">
            <i class="bi bi-building-x"></i>
            <strong>Data Site tidak ditemukan</strong>
            <span>Coba ubah kata pencarian atau tambahkan Site baru.</span>
          </div>
        `}
      </div>
    `;

  } catch (e) {
    console.error('renderSites:', e);

    $('#content').innerHTML =
      errorCard(
        'Site & Data Center gagal dimuat',
        e.message
      );

    toast(
      e.message || 'Site & Data Center gagal dimuat.',
      'error'
    );
  }
}


/*
 * NamaKota tetap menjadi sumber utama grouping.
 * Fallback hanya dipakai untuk data lama yang kolom NamaKota-nya masih kosong.
 */
const SITE_CITY_RULES = [
  {
    city: 'Trenggalek',
    re: /\b(TGK|TGL|TRENGGALEK|PANGGUL|DONGKO|WATULIMO|KAMPAK|PULE)\b/i
  },
  {
    city: 'Madiun',
    re: /\b(MDN|MDI|MADIUN)\b/i
  },
  {
    city: 'Bojonegoro',
    re: /\b(BJN|BOJONEGORO)\b/i
  },
  {
    city: 'Jakarta',
    re: /\b(JKT|JAKARTA|DUREN\s*TIGA|MTEN|MORITZ|WI215)\b/i
  },
  {
    city: 'Surabaya',
    re: /\b(SBY|SURABAYA)\b/i
  },
  {
    city: 'Malang',
    re: /\b(MLG|MALANG)\b/i
  },
  {
    city: 'Pasuruan',
    re: /\b(PSR|PASURUAN)\b/i
  },
  {
    city: 'Kediri',
    re: /\b(KDR|KEDIRI|KRAS)\b/i
  },
  {
    city: 'Mojokerto',
    re: /\b(MJK|MOJOKERTO)\b/i
  },
  {
    city: 'Ngawi',
    re: /\b(NGW|NGAWI)\b/i
  },
  {
    city: 'Tulungagung',
    re: /\b(TLG|TLA|TULUNGAGUNG)\b/i
  },
  {
    city: 'Blitar',
    re: /\b(BLT|BLITAR)\b/i
  },
  {
    city: 'Ponorogo',
    re: /\b(PNR|PONOROGO)\b/i
  },
  {
    city: 'Magetan',
    re: /\b(MGT|MAGETAN)\b/i
  },
  {
    city: 'Pacitan',
    re: /\b(PCT|PACITAN)\b/i
  },
  {
    city: 'Nganjuk',
    re: /\b(NGJ|NGANJUK)\b/i
  },
  {
    city: 'Jombang',
    re: /\b(JBG|JOMBANG)\b/i
  },
  {
    city: 'Sidoarjo',
    re: /\b(SDA|SIDOARJO)\b/i
  },
  {
    city: 'Gresik',
    re: /\b(GSK|GRESIK)\b/i
  },
  {
    city: 'Semarang',
    re: /\b(SMG|SEMARANG)\b/i
  },
  {
    city: 'Bandung',
    re: /\b(BDG|BANDUNG)\b/i
  },
  {
    city: 'Surakarta',
    re: /\b(SLO|SOLO|SURAKARTA)\b/i
  },
  {
    city: 'Yogyakarta',
    re: /\b(YGY|JOGJA|YOGYAKARTA)\b/i
  },
  {
    city: 'Denpasar',
    re: /\b(DPS|DENPASAR)\b/i
  }
];


function resolveSiteCity(site) {
  const manual = String(site?.NamaKota || '').trim();

  if (manual) {
    return {
      city: manual,
      source: 'manual'
    };
  }

  const lookupText = [
    site?.KodeSite,
    site?.NamaSite,
    site?.Alamat
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  for (const rule of SITE_CITY_RULES) {
    if (rule.re.test(lookupText)) {
      return {
        city: rule.city,
        source: 'auto'
      };
    }
  }

  return {
    city: 'Belum Ditentukan',
    source: 'unknown'
  };
}


function siteMatchesSearch(site, search) {
  const q = String(search || '').trim().toLowerCase();

  if (!q) return true;

  const resolved = resolveSiteCity(site);

  const haystack = [
    resolved.city,
    site.KodeSite,
    site.NamaSite,
    site.NamaKota,
    site.TipeSite,
    site.PICKoordinator,
    site.Alamat,
    site.Status,
    site.Keterangan
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(q);
}


function groupSitesByCity(rows) {
  const map = new Map();

  (rows || []).forEach(site => {
    const resolved = resolveSiteCity(site);
    const city = resolved.city;
    const key = city.toUpperCase();

    const row = Object.assign({}, site, {
      _ResolvedNamaKota: city,
      _CitySource: resolved.source
    });

    if (!map.has(key)) {
      map.set(key, {
        city,
        rows: []
      });
    }

    map.get(key).rows.push(row);
  });

  const groups = Array.from(map.values());

  groups.forEach(group => {
    group.rows.sort((a, b) =>
      String(a.KodeSite || '').localeCompare(
        String(b.KodeSite || ''),
        'id',
        { sensitivity: 'base' }
      )
    );
  });

  groups.sort((a, b) => {
    if (a.city === 'Belum Ditentukan') return 1;
    if (b.city === 'Belum Ditentukan') return -1;

    return a.city.localeCompare(
      b.city,
      'id',
      { sensitivity: 'base' }
    );
  });

  return groups;
}


function renderSiteCityGroup(group, index) {
  const bodyId = `siteCityBody${index}`;
  const total = group.rows.length;

  const dcCount = group.rows.filter(x =>
    String(x.TipeSite || '').toUpperCase() === 'DATA CENTER'
  ).length;

  const popCount = group.rows.filter(x =>
    String(x.TipeSite || '').toUpperCase() === 'POP'
  ).length;

  const autoCount = group.rows.filter(x =>
    x._CitySource === 'auto'
  ).length;

  return `
    <section class="site-group">
      <button
        type="button"
        class="site-group-toggle"
        onclick="toggleSiteCityGroup('${bodyId}', this)"
        aria-expanded="false"
      >
        <div class="site-group-main">
          <div class="site-group-icon">
            <i class="bi bi-geo-alt-fill"></i>
          </div>

          <div class="site-group-copy">
            <strong>${esc(group.city)}</strong>

            <small>
              ${total} lokasi terdaftar
              ${dcCount ? ` • ${dcCount} Data Center` : ''}
              ${popCount ? ` • ${popCount} POP` : ''}
              ${autoCount ? ` • ${autoCount} terdeteksi dari kode site` : ''}
            </small>
          </div>
        </div>

        <div class="site-group-meta">
          <span class="site-count-badge">
            ${total} Site
          </span>

          <span class="site-chevron">
            <i class="bi bi-chevron-down"></i>
          </span>
        </div>
      </button>

      <div
        id="${bodyId}"
        class="site-group-body hidden"
      >
        ${renderSiteGroupTable(group.rows)}
      </div>
    </section>
  `;
}


function renderSiteGroupTable(rows) {
  return table(
    [
      'Kode Site',
      'Nama Site',
      'Nama Kota',
      'Tipe',
      'PIC / Koordinator',
      'Alamat',
      'Status',
      'Aksi'
    ],

    (rows || []).map(x => {
      const city =
        x._ResolvedNamaKota ||
        resolveSiteCity(x).city;

      const source =
        x._CitySource ||
        resolveSiteCity(x).source;

      return `
        <tr>
          <td>
            <strong>${esc(x.KodeSite || '-')}</strong>
          </td>

          <td>
            <strong>${esc(x.NamaSite || '-')}</strong>
          </td>

          <td>
            <strong>${esc(city)}</strong>

            ${source === 'auto' ? `
              <br>
              <span class="badge bg-light text-secondary border mt-1">
                otomatis dari kode site
              </span>
            ` : ''}

            ${source === 'unknown' ? `
              <br>
              <span class="badge bg-warning-subtle text-warning-emphasis border mt-1">
                perlu diisi
              </span>
            ` : ''}
          </td>

          <td>
            ${esc(x.TipeSite || '-')}
          </td>

          <td>
            ${x.PICKoordinator ? `
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-person-circle text-secondary"></i>
                <span>${esc(x.PICKoordinator)}</span>
              </div>
            ` : '<span class="text-secondary">-</span>'}
          </td>

          <td>
            ${x.Alamat ? `
              <i class="bi bi-geo-alt me-1 text-secondary"></i>
              ${esc(x.Alamat)}
            ` : '<span class="text-secondary">-</span>'}
          </td>

          <td>
            ${badge(x.Status)}
          </td>

          <td>
            <div class="d-flex gap-1">
              ${can('sites.update') ? `
                <button
                  class="btn btn-sm btn-light"
                  onclick="openSiteForm('${x.SiteID}')"
                  title="Edit Site"
                >
                  <i class="bi bi-pencil"></i>
                </button>
              ` : ''}

              ${can('sites.deactivate') ? `
                <button
                  class="btn btn-sm btn-outline-danger"
                  onclick="deleteSiteUI('${x.SiteID}', '${esc(x.KodeSite || '')}')"
                  title="Hapus Site / Data Center"
                >
                  <i class="bi bi-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('')
  );
}


function toggleSiteCityGroup(bodyId, button) {
  const body =
    document.getElementById(bodyId);

  if (!body) return;

  const isOpening =
    body.classList.contains('hidden');

  body.classList.toggle('hidden');

  button?.classList.toggle(
    'open',
    isOpening
  );

  button?.setAttribute(
    'aria-expanded',
    isOpening ? 'true' : 'false'
  );

  const icon =
    button?.querySelector(
      '.site-chevron i'
    );

  if (icon) {
    icon.className =
      isOpening
        ? 'bi bi-chevron-up'
        : 'bi bi-chevron-down';
  }
}


function saveSiteSearch() {
  window.siteSearch =
    val('siteSearch').trim();

  renderSites();
}


function clearSiteSearch() {
  window.siteSearch = '';

  renderSites();
}


function openSiteForm(id = '') {
  const x =
    (window.siteRows || [])
      .find(a => a.SiteID === id) || {};

  const resolvedCity =
    id
      ? resolveSiteCity(x).city
      : '';

  const cityValue =
    String(x.NamaKota || '').trim() ||
    (resolvedCity === 'Belum Ditentukan'
      ? ''
      : resolvedCity);

  modal(
    id
      ? 'Edit Site'
      : 'Tambah Site',

    `
    <form id="siteForm" class="row g-3">

      <input
        type="hidden"
        name="SiteID"
        value="${esc(x.SiteID || '')}"
      >

      <div class="col-md-4">
        <label class="form-label">
          Kode Site
        </label>

        <input
          name="KodeSite"
          class="form-control"
          value="${esc(x.KodeSite || '')}"
          placeholder="Contoh: TGK-POP009"
          required
        >
      </div>

      <div class="col-md-4">
        <label class="form-label">
          Nama Site
        </label>

        <input
          name="NamaSite"
          class="form-control"
          value="${esc(x.NamaSite || '')}"
          placeholder="Contoh: POP Pule"
          required
        >
      </div>

      <div class="col-md-4">
        <label class="form-label">
          Nama Kota
        </label>

        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-geo-alt"></i>
          </span>

          <input
            name="NamaKota"
            class="form-control"
            value="${esc(cityValue)}"
            placeholder="Contoh: Trenggalek"
            required
          >
        </div>

        <div class="form-text">
          Menentukan grouping Site & Data Center.
          ${id && !x.NamaKota && cityValue
            ? ' Kota ini terdeteksi otomatis dari data Site lama.'
            : ''}
        </div>
      </div>

      <div class="col-md-6">
        <label class="form-label">
          Tipe Site
        </label>

        <select
          name="TipeSite"
          class="form-select"
          required
        >
          ${[
            'Data Center',
            'POP',
            'Kantor',
            'Warehouse',
            'Customer Site',
            'Lainnya'
          ].map(v => `
            <option
              value="${v}"
              ${x.TipeSite === v ? 'selected' : ''}
            >
              ${v}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="col-md-6">
        <label class="form-label">
          Status
        </label>

        <select
          name="Status"
          class="form-select"
          required
        >
          <option
            value="ACTIVE"
            ${x.Status === 'ACTIVE' || !x.Status ? 'selected' : ''}
          >
            ACTIVE
          </option>

          <option
            value="INACTIVE"
            ${x.Status === 'INACTIVE' ? 'selected' : ''}
          >
            INACTIVE
          </option>
        </select>
      </div>

      <div class="col-12">
        <label class="form-label">
          PIC / Koordinator
        </label>

        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-person-badge"></i>
          </span>

          <input
            name="PICKoordinator"
            class="form-control"
            value="${esc(x.PICKoordinator || '')}"
            placeholder="Nama PIC / Koordinator Site"
          >
        </div>
      </div>

      <div class="col-12">
        <label class="form-label">
          Alamat
        </label>

        <textarea
          name="Alamat"
          class="form-control"
          rows="3"
          placeholder="Alamat lengkap Site / Data Center"
        >${esc(x.Alamat || '')}</textarea>
      </div>

      <div class="col-12">
        <label class="form-label">
          Keterangan
        </label>

        <textarea
          name="Keterangan"
          class="form-control"
          rows="3"
          placeholder="Informasi tambahan..."
        >${esc(x.Keterangan || '')}</textarea>
      </div>

    </form>
    `,

    `
    <button
      type="button"
      class="btn btn-light"
      data-bs-dismiss="modal"
    >
      Batal
    </button>

    <button
      type="button"
      class="btn btn-primary"
      onclick="submitSite()"
    >
      <i class="bi bi-check-lg me-1"></i>
      Simpan
    </button>
    `
  );
}



async function deleteSiteUI(siteId, siteCode) {
  const confirmed = confirm(
    `Hapus Site / Data Center "${siteCode}"?\n\n` +
    'Data akan dinonaktifkan (soft delete), bukan dihapus permanen.'
  );

  if (!confirmed) return;

  try {
    const r = await gas(
      'deactivateSite',
      state.token,
      siteId
    );

    if (!r?.success) {
      throw new Error(
        r?.message ||
        'Site / Data Center gagal dihapus.'
      );
    }

    toast(
      r.message ||
      'Site / Data Center berhasil dihapus.'
    );

    await loadMaster();
    await renderSites();

  } catch (e) {
    toast(
      e.message ||
      'Site / Data Center gagal dihapus.',
      'error'
    );
  }
}


async function submitSite() {
  const form =
    document.getElementById('siteForm');

  if (
    !form ||
    !form.reportValidity()
  ) {
    return;
  }

  try {
    const r = await gas(
      'saveSite',
      state.token,
      obj(form)
    );

    if (!r?.success) {
      throw new Error(
        r?.message ||
        'Site gagal disimpan.'
      );
    }

    toast(
      r.message ||
      'Site berhasil disimpan.'
    );

    closeModal();

    await loadMaster();
    await renderSites();

  } catch (e) {
    toast(
      e.message ||
      'Site gagal disimpan.',
      'error'
    );
  }
}


async function renderRacks(page=1){setTitle('Rack Management','Rack per Site');loading();const r=await gas('listRacks',state.token,{page,pageSize:20,search:window.rackSearch||''});err(r);const d=r.data;window.rackRows=d.rows;
 $('#content').innerHTML=`<div class="toolbar mb-3"><h1 class="page-title">Rack Management</h1>${can('racks.create')?'<button class="btn btn-primary" onclick="openRackForm()"><i class="bi bi-plus-lg"></i> Tambah Rack</button>':''}</div><div class="cardx"><div class="toolbar mb-3"><div class="left"><input id="rackSearch" class="form-control" placeholder="Cari rack..." value="${esc(window.rackSearch||'')}"><button class="btn btn-light" onclick="window.rackSearch=val('rackSearch');renderRacks(1)">Cari</button></div></div>${table(['Rack','Site','Lokasi','Rack Unit','Status','Aksi'],d.rows.map(x=>`<tr><td><strong>${esc(x.KodeRack)}</strong></td><td>${esc(x.SiteCode)}</td><td>${esc(x.LokasiRack)}</td><td>${esc(x.JumlahRackUnit)}</td><td>${badge(x.Status)}</td><td><button class="btn btn-sm btn-light" onclick="openRackForm('${x.RackID}')"><i class="bi bi-pencil"></i></button></td></tr>`).join(''))}${pager(d,'renderRacks')}</div>`}
function openRackForm(id=''){const x=(window.rackRows||[]).find(a=>a.RackID===id)||{};const sites=state.master?.sites||[];modal(id?'Edit Rack':'Tambah Rack',`<form id="rackForm" class="row g-3"><input type="hidden" name="RackID" value="${esc(x.RackID||'')}"><div class="col-md-4"><label class="form-label">Kode Rack</label><input name="KodeRack" class="form-control" value="${esc(x.KodeRack||'')}" required></div><div class="col-md-4"><label class="form-label">Site</label><select name="SiteCode" class="form-select" required><option value="">Pilih</option>${sites.map(s=>`<option value="${esc(s.KodeSite)}" ${x.SiteCode===s.KodeSite?'selected':''}>${esc(s.KodeSite)} - ${esc(s.NamaSite)}</option>`).join('')}</select></div><div class="col-md-4"><label class="form-label">Rack Unit</label><input name="JumlahRackUnit" class="form-control" placeholder="42U" value="${esc(x.JumlahRackUnit||'')}" required></div><div class="col-md-6"><label class="form-label">Lokasi Rack</label><input name="LokasiRack" class="form-control" value="${esc(x.LokasiRack||'')}"></div><div class="col-md-6"><label class="form-label">Status</label><select name="Status" class="form-select"><option>ACTIVE</option><option ${x.Status==='INACTIVE'?'selected':''}>INACTIVE</option></select></div><div class="col-12"><label class="form-label">Keterangan</label><textarea name="Keterangan" class="form-control">${esc(x.Keterangan||'')}</textarea></div></form>`,`<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" onclick="submitRack()">Simpan</button>`)}
async function submitRack(){const f=$('#rackForm');if(!f.reportValidity())return;const r=await gas('saveRack',state.token,obj(f));if(!r.success)return toast(r.message,'error');toast(r.message);closeModal();await loadMaster();renderRacks(1)}

function openDeviceForm(id = '', scope = deviceScope) {
  const x = (window.deviceRows || []).find(d => d.DeviceID === id) || {};
  const types = state.master?.deviceTypes || [];
  const allSites = state.master?.sites || [];

  /*
   * DC   = hanya Site tipe Data Center
   * SITE = selain Data Center
   */
  const sites = allSites.filter(s => {
    const tipe = String(s.TipeSite || '').toUpperCase();

    return scope === 'DC'
      ? tipe === 'DATA CENTER'
      : tipe !== 'DATA CENTER';
  });


  modal(
    id ? 'Edit Device' : 'Tambah Device',

    `
    <form id="deviceForm" class="row g-3">

      <input type="hidden"
             name="DeviceID"
             value="${esc(x.DeviceID || '')}">

      <input type="hidden"
             name="DeviceScope"
             value="${scope}">


      <div class="col-md-6">
        <label class="form-label">Nama Device</label>

        <input name="NamaDevice"
               class="form-control"
               value="${esc(x.NamaDevice || '')}"
               required>
      </div>


      <div class="col-md-3">
        <label class="form-label">Brand</label>

        <input name="Brand"
               class="form-control"
               value="${esc(x.Brand || '')}"
               placeholder="MikroTik, Huawei, ZTE..."
               required>
      </div>


      <div class="col-md-3">
        <label class="form-label">Tipe Device</label>

        <input name="TipeDevice"
               class="form-control"
               value="${esc(x.TipeDevice || '')}"
               placeholder="CCR2004, C320..."
               required>
      </div>


      <div class="col-md-3">
        <label class="form-label">Jenis</label>

        <select name="JenisDevice"
                class="form-select"
                required>

          <option value="">Pilih</option>

          ${types.map(t => `
            <option value="${esc(t.NamaJenis)}"
                    ${x.JenisDevice === t.NamaJenis ? 'selected' : ''}>
              ${esc(t.NamaJenis)}
            </option>
          `).join('')}

        </select>
      </div>


      <div class="col-md-3">
        <label class="form-label">Serial Number</label>

        <input name="SerialNumber"
               class="form-control"
               value="${esc(x.SerialNumber || '')}">
      </div>


      <div class="col-md-3">
        <label class="form-label">IP Management</label>

        <input name="IPAddress"
               class="form-control"
               value="${esc(x.IPAddress || '')}"
               placeholder="Contoh: 103.148.24.164">
      </div>


      <div class="col-md-3">
        <label class="form-label">Port Access</label>

        <input name="Port"
               class="form-control"
               value="${esc(x.Port || '')}"
               placeholder="Contoh: 8291 / 8887">
      </div>


      <div class="col-md-4">
        <label class="form-label">Site</label>

        <select id="deviceSite"
                name="SiteCode"
                class="form-select">

          <option value="">Pilih Site</option>

          ${sites.map(s => `
            <option value="${esc(s.KodeSite)}"
                    ${x.SiteCode === s.KodeSite ? 'selected' : ''}>
              ${esc(s.KodeSite)} - ${esc(s.NamaSite)}
            </option>
          `).join('')}

        </select>
      </div>


      <div class="col-md-4">
        <label class="form-label">Rack</label>

        <input
          name="RackCode"
          class="form-control"
          value="${esc(x.RackCode || '')}"
          placeholder="Contoh: WI215 / RACK-A1"
          autocomplete="off"
        >

        <div class="form-text">
          Isi kode / nama Rack secara manual.
        </div>
      </div>


      <div class="col-md-4">
        <label class="form-label">Rack Unit</label>

        <input name="RackUnit"
               class="form-control"
               value="${esc(x.RackUnit || '')}"
               placeholder="Contoh: U17">
      </div>


      <div class="col-md-4">
        <label class="form-label">Status</label>

        <select name="StatusDevice"
                class="form-select">

          ${[
            'ACTIVE',
            'SPARE',
            'MAINTENANCE',
            'RUSAK',
            'KELUAR',
            'DECOMMISSIONED'
          ].map(v => `
            <option value="${v}"
                    ${x.StatusDevice === v ? 'selected' : ''}>
              ${v}
            </option>
          `).join('')}

        </select>
      </div>


      <div class="col-md-4">
        <label class="form-label">Kondisi</label>

        <input name="Kondisi"
               class="form-control"
               value="${esc(x.Kondisi || '')}"
               placeholder="Baik / Rusak / Maintenance">
      </div>


      <div class="col-md-4">
        <label class="form-label">Lokasi Detail</label>

        <input name="LokasiDevice"
               class="form-control"
               value="${esc(x.LokasiDevice || '')}"
               placeholder="Contoh: Mojokerto">
      </div>


      <div class="col-12">
        <label class="form-label">Keterangan</label>

        <textarea name="Keterangan"
                  class="form-control"
                  rows="3">${esc(x.Keterangan || '')}</textarea>
      </div>

    </form>
    `,


    `
    ${id && can('devices.deactivate') ? `
      <button type="button"
              class="btn btn-outline-danger me-auto"
              onclick="deleteDeviceFromEdit('${x.DeviceID}')">

        <i class="bi bi-trash me-1"></i>
        Hapus Device
      </button>
    ` : ''}


    <button type="button"
            class="btn btn-light"
            data-bs-dismiss="modal">
      Batal
    </button>


    <button type="button"
            class="btn btn-primary"
            onclick="submitDevice()">

      <i class="bi bi-check-lg me-1"></i>
      Simpan
    </button>
    `
  );
}

async function submitDevice() {
  const form = document.getElementById('deviceForm');

  if (!form || !form.reportValidity()) return;


  try {
    const data = obj(form);

    const r = await gas(
      'saveDevice',
      state.token,
      data
    );

    if (!r?.success) {
      throw new Error(
        r?.message || 'Device gagal disimpan.'
      );
    }


    toast(r.message || 'Device berhasil disimpan.');

    closeModal();

    /*
     * Refresh master agar daftar Site tetap sinkron.
     */
    await loadMaster();

    await renderDevices(1);

  } catch (e) {
    toast(
      e.message || 'Device gagal disimpan.',
      'error'
    );
  }
}

async function deleteDeviceFromEdit(deviceId) {
  const device = (window.deviceRows || [])
    .find(x => x.DeviceID === deviceId);

  const nama = device?.NamaDevice || deviceId;

  if (!confirm(
    `Hapus device "${nama}"?\n\n` +
    `Device akan dinonaktifkan, tetapi histori perangkat tetap disimpan.`
  )) return;


  try {
    const r = await gas(
      'deactivateDevice',
      state.token,
      deviceId
    );

    if (!r?.success) throw new Error(r?.message || 'Gagal menghapus device.');

    toast('Device berhasil dihapus.');
    closeModal();

    await renderDevices(1);

  } catch (e) {
    toast(
      e.message || 'Gagal menghapus device.',
      'error'
    );
  }
}


async function showHistory(id){const r=await gas('getDeviceHistory',state.token,id);if(!r.success)return toast(r.message,'error');modal('Device Movement History',table(['Tanggal','Type','From','To','Keterangan'],r.data.map(x=>`<tr><td>${esc(x.Tanggal)}</td><td>${badge(x.MovementType)}</td><td>${esc(x.FromSite)} / ${esc(x.FromRack)}</td><td>${esc(x.ToSite)} / ${esc(x.ToRack)}</td><td>${esc(x.Keterangan)}</td></tr>`).join('')),'<button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>')}

async function renderPermits(page = 1) {

  setTitle(
    'Data Center Permit',
    'Pengajuan dan approval izin masuk Data Center'
  );
  loading();
  try {
    const r = await gas(
      'listPermits',
      state.token,
      {
        page: page,
        pageSize: 20,
        search:
          window.permitSearch || ''
      }
    );

    if (!r) {
      throw new Error(
        'Backend tidak memberikan response.'
      );
    }
    if (!r.success) {
      throw new Error(
        r.message ||
        'Gagal mengambil data Permit.'
      );
    }
    const d =
      r.data;
    window.permitRows =
      d.rows || [];
    $('#content').innerHTML = `
      <div class="toolbar mb-3">

        <div>

          <h1 class="page-title">
            Data Center Permit
          </h1>

          <div class="page-sub">
            Pengajuan dan approval izin masuk Data Center
          </div>
        </div>
        ${
          can('permits.create')
            ? `
              <button
                class="btn btn-primary"
                onclick="openPermitForm()"
              >
                <i class="bi bi-plus-lg"></i>
                Pengajuan
              </button>
            `
            : ''
        }
      </div>
      <div class="cardx">
        <div class="toolbar mb-3">
          <div class="left">
            <input
              id="permitSearch"
              class="form-control"
              placeholder="Cari pengajuan..."
              value="${
                esc(
                  window.permitSearch ||
                  ''
                )
              }"
            >
            <button
              class="btn btn-light"
              onclick="
                window.permitSearch =
                  val('permitSearch');

                renderPermits(1);
              "
            >
              <i class="bi bi-search me-1"></i>
              Cari
            </button>
          </div>
        </div>

        ${table(
          [
            'Tanggal',
            'Nama',
            'Site',
            'Tujuan',
            'Jadwal Masuk',
            'Jam Masuk',
            'Jam Keluar',
            'Status',
            'Aksi'
          ],

          window.permitRows.map(x => {
            const status =
              String(
                x.Status || ''
              ).toUpperCase();
            return `
              <tr>
                <td>
                  ${esc(
                    x.TanggalPengajuan ||
                    '-'
                  )}
                </td>
                <td>
                  <strong>
                    ${esc(
                      x.Nama || '-'
                    )}
                  </strong>
                  ${
                    x.Instansi
                      ? `
                        <br>
                        <small
                          class="text-secondary"
                        >
                          ${esc(
                            x.Instansi
                          )}
                        </small>

                      `
                      : ''
                  }
                </td>
                <td>

                  ${
                    x.SiteTujuan
                      ? `
                        <i
                          class="bi bi-building me-1 text-secondary"
                        ></i>

                        ${esc(
                          x.SiteTujuan
                        )}

                      `
                      : '-'
                  }

                </td>
                <td>
                  ${esc(
                    x.Tujuan || '-'
                  )}
                </td>
                <td>
                  ${
                    x.TanggalMasuk
                      ? `

                        <i
                          class="bi bi-calendar3 me-1 text-secondary"
                        ></i>

                        ${esc(
                          x.TanggalMasuk
                        )}
                      `
                      : '-'
                  }
                </td>
                <td>
                  ${
                    x.JamMasuk
                      ? `

                        <i
                          class="bi bi-clock me-1 text-secondary"
                        ></i>

                        ${esc(
                          x.JamMasuk
                        )}

                      `
                      : '-'
                  }
                </td>
                <td>

                  ${
                    x.JamSelesai
                      ? `
                        <i
                          class="bi bi-box-arrow-right me-1 text-secondary"
                        ></i>
                        ${esc(
                          x.JamSelesai
                        )}
                      `
                      : `
                        <span class="text-secondary">
                          -
                        </span>
                     `
                  }
                </td>
                <td>
                  ${badge(
                    x.Status
                  )}
                </td>

                <td>
                  <div class="d-flex gap-1">
                    ${
                      status ===
                        'PENDING' &&
                      can(
                        'permits.approve'
                      )
                        ? `
                          <button
                            class="btn btn-sm btn-success"
                            onclick="
                              decidePermitUI(
                                '${x.PermitID}',
                                'APPROVED'
                              )
                            "
                            title="Approve"
                          >
                            <i class="bi bi-check-lg"></i>
                          </button>
                          <button
                            class="btn btn-sm btn-outline-danger"
                            onclick="
                              decidePermitUI(
                                '${x.PermitID}',
                                'REJECTED'
                              )
                            "
                            title="Reject"
                          >
                            <i class="bi bi-x-lg"></i>
                          </button>
                        `
                        : ''
                    }
                    ${
                      status ===
                        'APPROVED' &&
                      can(
                        'permits.create'
                      )
                        ? `
                          <button
                            class="btn btn-sm btn-primary"
                            onclick="
                              openPermitExitForm(
                                '${x.PermitID}'
                              )
                            "
                            title="Catat Jam Keluar"
                          >
                            <i class="bi bi-box-arrow-right"></i>
                          </button>
                        `
                        : ''
                    }
                  </div>
                </td>
              </tr>

            `;

          }).join('')
        )}
        ${
          pager(
            d,
            'renderPermits'
          )
        }
      </div>
    `;
  } catch (e) {

    console.error(
      'renderPermits ERROR:',
      e
    );

    $('#content').innerHTML = `
      <div class="cardx">
        <div
          class="d-flex align-items-start gap-3"
        >
          <div
            class="text-danger"
            style="font-size:32px"
          >
            <i
              class="bi bi-exclamation-triangle"
            ></i>
          </div>
          <div>
            <h5>
              Data Center Permit gagal dimuat
            </h5>

            <div
              class="text-secondary mb-3"
            >
              ${
                esc(
                  e.message ||
                  'Terjadi kesalahan.'
                )
              }
            </div>
            <button
              class="btn btn-primary"
              onclick="renderPermits(1)"
            >
              <i
                class="bi bi-arrow-clockwise me-1"
              ></i>
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    `;
    toast(
      e.message ||
      'Data Center Permit gagal dimuat.',
      'error'
    );
  }
}
function openPermitForm() {
  const sites =
    state.master?.sites || [];
  const dcs =
    sites.filter(s =>
      String(
        s.TipeSite || ''
      ).toUpperCase() ===
      'DATA CENTER'
    );

  modal(

    'Pengajuan Izin Data Center',
    `
    <form
      id="permitForm"
      class="row g-3"
    >
      <div class="col-md-6">

        <label class="form-label">
          Nama
        </label>

        <input
          name="Nama"
          class="form-control"
          required
        >
      </div>
      <div class="col-md-6">

        <label class="form-label">
          NIK
        </label>
        <input
          name="NIK"
          class="form-control"
          inputmode="numeric"
          maxlength="16"
          minlength="16"
          required
        >
      </div>
      <div class="col-md-6">

        <label class="form-label">
          Instansi / PT
        </label>

        <input
          name="Instansi"
          class="form-control"
          required
        >
      </div>
      <div class="col-md-6">

        <label class="form-label">
          Divisi
        </label>

        <input
          name="Divisi"
          class="form-control"
        >
      </div>
      <div class="col-12">

        <label class="form-label">
          Alamat
        </label>
        <textarea
          name="Alamat"
          class="form-control"
          rows="2"
          required
        ></textarea>

      </div>
      <div class="col-md-6">

        <label class="form-label">
          Data Center
        </label>

        <select
          name="SiteTujuan"
          class="form-select"
          required
        >

          <option value="">
            Pilih Data Center
          </option>

          ${
            dcs.map(s => `

              <option
                value="${esc(s.KodeSite)}"
              >

                ${esc(s.KodeSite)}
                -
                ${esc(s.NamaSite)}

              </option>

            `).join('')
          }

        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label">
          Jadwal Masuk
        </label>
        <input
          name="TanggalMasuk"
          type="date"
          class="form-control"
          required
        >
      </div>
      <div class="col-md-6">
        <label class="form-label">
          Jam Masuk
        </label>

        <input
          name="JamMasuk"
          type="time"
          class="form-control"
          required
        >
      </div>
      <div class="col-md-6">

        <label class="form-label">
          Jam Keluar
        </label>

        <input
          class="form-control"
          value="Diisi setelah aktivitas selesai"
          disabled
        >
        <div class="form-text">
          Jam keluar akan dicatat ketika client selesai beraktivitas.
        </div>
      </div>
      <div class="col-12">

        <label class="form-label">
          Tujuan
        </label>

        <textarea
          name="Tujuan"
          class="form-control"
          rows="3"
          required
        ></textarea>

      </div>
    </form>
    `,
    `
      <button
        class="btn btn-light"
        data-bs-dismiss="modal"
      >
        Batal
      </button>
      <button
        class="btn btn-primary"
        onclick="submitPermit()"
      >
        <i class="bi bi-send me-1"></i>
        Kirim
      </button>
    `
  );
}
async function submitPermitExit(
  permitId
) {

  const jam =
    val(
      'permitExitTime'
    );
  if (!jam) {
    toast(
      'Jam keluar wajib diisi.',
      'error'
    );
    return;
  }
  try {

    const r =
      await gas(
        'completePermit',
        state.token,
        permitId,
        jam
      );
    if (!r.success) {
      throw new Error(
        r.message
      );
    }
    toast(
      r.message
    );
    closeModal();
    await renderPermits(1);
  } catch (e) {

    toast(
      e.message ||
      'Jam keluar gagal disimpan.',
      'error'
    );

  }

}
function openPermitExitForm(
  permitId
) {

  const permit =
    (window.permitRows || [])
      .find(
        x =>
          x.PermitID ===
          permitId
      );
  if (!permit) {
    toast(
      'Permit tidak ditemukan.',
      'error'
    );

    return;
  }

  const sekarang =
    new Date();
  const jam =
    String(
      sekarang.getHours()
    ).padStart(2, '0');
  const menit =
    String(
      sekarang.getMinutes()
    ).padStart(2, '0');
  const jamSekarang =
    `${jam}:${menit}`;


  modal(
    'Catat Jam Keluar',
    `
      <div class="mb-3">

        <small class="text-secondary">
          Nama
        </small>

        <div class="fw-bold">
          ${esc(permit.Nama)}
        </div>

      </div>
      <div class="mb-3">
        <small class="text-secondary">
          Data Center
        </small>

        <div class="fw-bold">
          ${esc(
            permit.SiteTujuan
          )}
        </div>

      </div>
      <div class="mb-3">
        <small class="text-secondary">
          Masuk
        </small>

        <div class="fw-bold">

          ${esc(
            permit.TanggalMasuk
          )}

          &nbsp;

          ${esc(
            permit.JamMasuk
          )}

        </div>
      </div>
      <div>

        <label class="form-label">
          Jam Keluar
        </label>

        <input
          id="permitExitTime"
          type="time"
          class="form-control"
          value="${jamSekarang}"
          required
        >
      </div>
    `,
    `
      <button
        class="btn btn-light"
        data-bs-dismiss="modal"
      >
        Batal
      </button>
      <button
        class="btn btn-primary"
        onclick="
          submitPermitExit(
            '${permitId}'
          )
        "
      >
        <i class="bi bi-check-lg me-1"></i>

        Simpan Jam Keluar

      </button>

    `
  );

}

async function submitPermit() {
  const form =
    document.getElementById(
      'permitForm'
    );
  if (
    !form ||
    !form.reportValidity()
  ) {
    return;
  }

  try {
    const data =
      obj(form);
    const r =
      await gas(
        'createPermit',
        state.token,
        data
      );
    if (!r.success) {
      throw new Error(
        r.message
      );
    }
    toast(
      r.message
    );
    closeModal();
    await renderPermits(1);
  } catch (e) {

    toast(
      e.message ||
      'Pengajuan gagal disimpan.',
      'error'
    );

  }
}
async function decidePermitUI(
  permitId,
  decision
) {
  const action =
    decision === 'APPROVED'
      ? 'menyetujui'
      : 'menolak';
  const confirmed =
    confirm(
      `Yakin ingin ${action} pengajuan ini?`
    );
  if (!confirmed) {
    return;
  }
  const note =
    prompt(
      'Catatan approval / rejection (opsional):'
    ) || '';
  try {
    const r =
      await gas(
        'decidePermit',
        state.token,
        permitId,
        decision,
        note
      );
    if (!r.success) {
      throw new Error(
        r.message
      );
    }
    toast(
      r.message
    );
    await renderPermits(1);
  } catch (e) {
    toast(
      e.message,
      'error'
    );
  }
}

async function renderDeviceIn(page=1){setTitle('Device IN','Perangkat masuk');loading();const r=await gas('listDeviceIn',state.token,{page,pageSize:20});err(r);const d=r.data;$('#content').innerHTML=`<div class="toolbar mb-3"><h1 class="page-title">Device IN</h1>${can('devicein.create')?'<button class="btn btn-primary" onclick="openDeviceInForm()"><i class="bi bi-plus-lg"></i> Catat Device IN</button>':''}</div><div class="cardx">${table(['Tanggal','Device','SN','Tujuan','Rack','Kondisi','Status'],d.rows.map(x=>`<tr><td>${esc(x.TanggalMasuk)}</td><td><strong>${esc(x.NamaDevice)}</strong><br><small>${esc(x.Brand)} ${esc(x.Tipe)}</small></td><td>${esc(x.SerialNumber)}</td><td>${esc(x.SiteTujuan)}</td><td>${esc(x.RackTujuan)}</td><td>${esc(x.Kondisi)}</td><td>${badge(x.Status)}</td></tr>`).join(''))}${pager(d,'renderDeviceIn')}</div>`}

function openDeviceInForm(){const sites=state.master?.sites||[],types=state.master?.deviceTypes||[];modal('Catat Device IN',`<form id="dinForm" class="row g-3"><div class="col-md-4"><label class="form-label">Tanggal Masuk</label><input name="TanggalMasuk" type="date" class="form-control" required></div><div class="col-md-8"><label class="form-label">Nama Device</label><input name="NamaDevice" class="form-control" required></div><div class="col-md-4"><label class="form-label">Brand</label><input name="Brand" class="form-control" required></div><div class="col-md-4"><label class="form-label">Jenis Device</label><select name="JenisDevice" class="form-select">${types.map(t=>`<option>${esc(t.NamaJenis)}</option>`).join('')}</select></div><div class="col-md-4"><label class="form-label">Tipe</label><input name="Tipe" class="form-control" required></div><div class="col-md-6"><label class="form-label">Serial Number</label><input name="SerialNumber" class="form-control"></div><div class="col-md-6"><label class="form-label">Kelengkapan</label><input name="KelengkapanDevice" class="form-control" required></div><div class="col-md-4"><label class="form-label">Site Tujuan</label><select id="dinSite" name="SiteTujuan" class="form-select" onchange="syncDinRack()" required><option value="">Pilih</option>${sites.map(s=>`<option value="${esc(s.KodeSite)}">${esc(s.KodeSite)}</option>`).join('')}</select></div><div class="col-md-4"><label class="form-label">Rack Tujuan</label><select id="dinRack" name="RackTujuan" class="form-select"><option value="">-</option></select></div><div class="col-md-4"><label class="form-label">Rack Unit</label><input name="RackUnit" class="form-control"></div><div class="col-md-6"><label class="form-label">Kondisi</label><input name="Kondisi" class="form-control" required></div><div class="col-md-6"><label class="form-label">Dibawa Oleh</label><input name="DibawaOleh" class="form-control"></div><div class="col-12"><label class="form-label">Keterangan</label><textarea name="Keterangan" class="form-control"></textarea></div></form>`,`<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" onclick="submitDin()">Simpan</button>`)}

function syncDinRack(){const site=val('dinSite');$('#dinRack').innerHTML='<option value="">-</option>'+(state.master?.racks||[]).filter(r=>r.SiteCode===site).map(r=>`<option>${esc(r.KodeRack)}</option>`).join('')}
async function submitDin(){const f=$('#dinForm');if(!f.reportValidity())return;const r=await gas('createDeviceIn',state.token,obj(f));if(!r.success)return toast(r.message,'error');toast(r.message);closeModal();renderDeviceIn(1)}

async function renderDeviceOut(page=1){setTitle('Device OUT','Perangkat keluar');loading();const r=await gas('listDeviceOut',state.token,{page,pageSize:20});err(r);const d=r.data;$('#content').innerHTML=`<div class="toolbar mb-3"><h1 class="page-title">Device OUT</h1>${can('deviceout.create')?'<button class="btn btn-primary" onclick="openDeviceOutForm()"><i class="bi bi-plus-lg"></i> Catat Device OUT</button>':''}</div><div class="cardx">${table(['Tanggal','Device','SN','Asal','Tujuan','Dibawa','Status'],d.rows.map(x=>`<tr><td>${esc(x.TanggalKeluar)}</td><td><strong>${esc(x.NamaDevice)}</strong></td><td>${esc(x.SerialNumber)}</td><td>${esc(x.SiteAsal)} / ${esc(x.RackAsal)}</td><td>${esc(x.TujuanKeluar)}</td><td>${esc(x.DibawaOleh)}</td><td>${badge(x.Status)}</td></tr>`).join(''))}${pager(d,'renderDeviceOut')}</div>`}

async function openDeviceOutForm(){const r=await gas('listDevices',state.token,{page:1,pageSize:100});if(!r.success)return toast(r.message,'error');modal('Catat Device OUT',`<form id="doutForm" class="row g-3"><div class="col-md-4"><label class="form-label">Tanggal Keluar</label><input name="TanggalKeluar" type="date" class="form-control" required></div><div class="col-md-8"><label class="form-label">Device</label><select name="DeviceID" class="form-select" required><option value="">Pilih Device</option>${r.data.rows.map(d=>`<option value="${esc(d.DeviceID)}">${esc(d.NamaDevice)} | ${esc(d.SerialNumber)} | ${esc(d.SiteCode)}/${esc(d.RackCode)}</option>`).join('')}</select></div><div class="col-md-6"><label class="form-label">Kelengkapan</label><input name="KelengkapanDevice" class="form-control" required></div><div class="col-md-6"><label class="form-label">Dibawa Oleh</label><input name="DibawaOleh" class="form-control"></div><div class="col-12"><label class="form-label">Tujuan Keluar</label><input name="TujuanKeluar" class="form-control" required></div><div class="col-12"><label class="form-label">Keterangan</label><textarea name="Keterangan" class="form-control" required></textarea></div></form>`,`<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" onclick="submitDout()">Simpan</button>`)}
async function submitDout(){const f=$('#doutForm');if(!f.reportValidity())return;const r=await gas('createDeviceOut',state.token,obj(f));if(!r.success)return toast(r.message,'error');toast(r.message);closeModal();renderDeviceOut(1)}


const TICKET_CATEGORIES = [
  'Fiber Cut',
  'Link Down',
  'High Latency',
  'Packet Loss',
  'BGP Down',
  'Power Failure',
  'Device Down',
  'Device Restart / Reboot',
  'OLT Down',
  'PPPoE / Authentication',
  'Routing Problem',
  'DNS Problem',
  'Bandwidth / Congestion',
  'Data Center',
  'Upstream Provider',
  'Maintenance Impact',
  'Customer / Corporate Link',
  'Other'
];

const TICKET_SEVERITIES = [
  'P1 - CRITICAL',
  'P2 - HIGH',
  'P3 - MEDIUM',
  'P4 - LOW'
];

const TICKET_STATUSES = [
  'OPEN',
  'IN PROGRESS',
  'MONITORING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED'
];


function ticketSeverityBadge(value) {
  const v = String(value || '').toUpperCase();

  let cls = 'ticket-sev-low';

  if (v.startsWith('P1')) {
    cls = 'ticket-sev-critical';
  } else if (v.startsWith('P2')) {
    cls = 'ticket-sev-high';
  } else if (v.startsWith('P3')) {
    cls = 'ticket-sev-medium';
  }

  return `
    <span class="ticket-severity ${cls}">
      ${esc(value || '-')}
    </span>
  `;
}


function ticketStatusBadge(value) {
  const v = String(value || '').toUpperCase();

  const map = {
    'OPEN': 'ticket-status-open',
    'IN PROGRESS': 'ticket-status-progress',
    'MONITORING': 'ticket-status-monitoring',
    'RESOLVED': 'ticket-status-resolved',
    'CLOSED': 'ticket-status-closed',
    'CANCELLED': 'ticket-status-cancelled'
  };

  return `
    <span class="ticket-status ${map[v] || ''}">
      ${esc(value || '-')}
    </span>
  `;
}


function ticketFormatDateTime(value) {
  if (!value) return '-';

  const raw = String(value);

  const d = new Date(raw);

  if (Number.isNaN(d.getTime())) {
    return esc(raw.replace('T', ' '));
  }

  try {
    return new Intl.DateTimeFormat(
      'id-ID',
      {
        day:'2-digit',
        month:'2-digit',
        year:'numeric',
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      }
    ).format(d);
  } catch (_) {
    return esc(raw.replace('T', ' '));
  }
}


function ticketDurationText(minutes) {
  const n = Number(minutes);

  if (!Number.isFinite(n) || n < 0) {
    return '-';
  }

  const days = Math.floor(n / 1440);
  const hours = Math.floor(
    (n % 1440) / 60
  );
  const mins = n % 60;

  const parts = [];

  if (days) parts.push(`${days}h`);
  if (hours) parts.push(`${hours}j`);
  if (mins || !parts.length) {
    parts.push(`${mins}m`);
  }

  return parts.join(' ');
}


async function renderTickets(page = 1) {
  setTitle(
    'TIKET GANGGUAN',
    'Incident & Trouble Ticket Management'
  );

  loading();

  try {
    const r = await gas(
      'listIncidentTickets',
      state.token,
      {
        page,
        pageSize: 20,
        search:
          window.ticketSearch || '',
        status:
          window.ticketStatus || '',
        severity:
          window.ticketSeverity || ''
      }
    );

    err(r);

    const d = r.data || {};
    const rows = d.rows || [];
    const stats = d.stats || {};

    window.ticketRows = rows;

    $('#content').innerHTML = `
      <div class="toolbar mb-4 ticket-page-head">
        <div>
          <div class="d-flex align-items-center gap-2">
            <h1 class="page-title mb-0">
              Tiket Gangguan
            </h1>

            <span class="ticket-module-chip">
              NOC INCIDENT
            </span>
          </div>

          <div class="page-sub">
            Monitoring dan penanganan gangguan jaringan
          </div>
        </div>

        ${ticketCanManage() ? `
          <button
            class="btn btn-primary"
            onclick="openTicketForm()"
          >
            <i class="bi bi-plus-lg me-1"></i>
            Buat Tiket
          </button>
        ` : ''}
      </div>

      <div class="ticket-kpi-grid">
        ${ticketKpiCard(
          'OPEN',
          stats.open || 0,
          'bi-exclamation-circle',
          'ticket-kpi-open'
        )}

        ${ticketKpiCard(
          'IN PROGRESS',
          stats.inProgress || 0,
          'bi-tools',
          'ticket-kpi-progress'
        )}

        ${ticketKpiCard(
          'P1 CRITICAL',
          stats.critical || 0,
          'bi-lightning-charge',
          'ticket-kpi-critical'
        )}

        ${ticketKpiCard(
          'MONITORING',
          stats.monitoring || 0,
          'bi-activity',
          'ticket-kpi-monitoring'
        )}

        ${ticketKpiCard(
          'RESOLVED TODAY',
          stats.resolvedToday || 0,
          'bi-check-circle',
          'ticket-kpi-resolved'
        )}
      </div>

      <div class="cardx ticket-list-card">
        <div class="ticket-filterbar">
          <div class="ticket-filter-search">
            <i class="bi bi-search"></i>

            <input
              id="ticketSearch"
              class="form-control"
              placeholder="Cari nomor tiket, site, device, gangguan, PIC..."
              value="${esc(window.ticketSearch || '')}"
              onkeydown="
                if(event.key==='Enter'){
                  applyTicketFilters()
                }
              "
            >
          </div>

          <select
            id="ticketStatusFilter"
            class="form-select"
          >
            <option value="">
              Semua Status
            </option>

            ${TICKET_STATUSES.map(v => `
              <option
                value="${v}"
                ${window.ticketStatus === v ? 'selected' : ''}
              >
                ${v}
              </option>
            `).join('')}
          </select>

          <select
            id="ticketSeverityFilter"
            class="form-select"
          >
            <option value="">
              Semua Severity
            </option>

            ${TICKET_SEVERITIES.map(v => `
              <option
                value="${v}"
                ${window.ticketSeverity === v ? 'selected' : ''}
              >
                ${v}
              </option>
            `).join('')}
          </select>

          <button
            class="btn btn-light"
            onclick="applyTicketFilters()"
          >
            <i class="bi bi-funnel me-1"></i>
            Terapkan
          </button>

          ${
            window.ticketSearch ||
            window.ticketStatus ||
            window.ticketSeverity
              ? `
                <button
                  class="btn btn-light"
                  onclick="resetTicketFilters()"
                  title="Reset filter"
                >
                  <i class="bi bi-x-lg"></i>
                </button>
              `
              : ''
          }
        </div>

        ${table(
          [
            'Ticket',
            'Lapor / Mulai',
            'Severity',
            'Kota / Site',
            'Gangguan',
            'PIC',
            'Status',
            'Durasi',
            'Action'
          ],

          rows.map(x => `
            <tr>
              <td>
                <button
                  type="button"
                  class="ticket-number-link"
                  onclick="openTicketDetail('${x.TicketID}')"
                >
                  ${esc(x.TicketNumber || '-')}
                </button>

                <div class="ticket-row-sub">
                  ${esc(x.Category || '-')}
                </div>
              </td>

              <td>
                <strong>
                  ${ticketFormatDateTime(x.ReportedAt)}
                </strong>

                <div class="ticket-row-sub">
                  Mulai:
                  ${ticketFormatDateTime(x.IncidentStart)}
                </div>
              </td>

              <td>
                ${ticketSeverityBadge(x.Severity)}
              </td>

              <td>
                <strong>
                  ${esc(x.City || '-')}
                </strong>

                <div class="ticket-row-sub">
                  ${esc(x.SiteCode || '-')}
                </div>
              </td>

              <td class="ticket-title-cell">
                <strong>
                  ${esc(x.Title || '-')}
                </strong>

                <div class="ticket-row-sub">
                  ${
                    x.DeviceName
                      ? `Device: ${esc(x.DeviceName)}`
                      : esc(x.AffectedService || '-')
                  }
                </div>
              </td>

              <td>
                ${esc(x.AssignedTo || '-')}
              </td>

              <td>
                ${ticketStatusBadge(x.Status)}
              </td>

              <td>
                ${ticketDurationText(x.DurationMinutes)}
              </td>

              <td>
                <div class="d-flex gap-1 ticket-actions">
                  <button
                    class="btn btn-sm btn-light"
                    onclick="openTicketDetail('${x.TicketID}')"
                    title="Detail"
                  >
                    <i class="bi bi-eye"></i>
                  </button>

                  ${ticketCanManage() ? `
                    <button
                      class="btn btn-sm btn-light"
                      onclick="openTicketProgress('${x.TicketID}')"
                      title="Update Progress"
                    >
                      <i class="bi bi-activity"></i>
                    </button>

                    <button
                      class="btn btn-sm btn-light"
                      onclick="openTicketForm('${x.TicketID}')"
                      title="Edit Tiket"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                  ` : ''}

                  ${ticketCanDelete() ? `
                    <button
                      class="btn btn-sm btn-outline-danger"
                      onclick="deleteTicketUI('${x.TicketID}')"
                      title="Hapus Tiket"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')
        )}

        ${pager(d, 'renderTickets')}
      </div>
    `;

  } catch (e) {
    console.error(
      'renderTickets:',
      e
    );

    $('#content').innerHTML =
      errorCard(
        'Tiket Gangguan gagal dimuat',
        e.message
      );

    toast(
      e.message ||
      'Tiket Gangguan gagal dimuat.',
      'error'
    );
  }
}


function ticketKpiCard(
  label,
  value,
  icon,
  cls
) {
  return `
    <div class="ticket-kpi ${cls}">
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
      </div>

      <i class="bi ${icon}"></i>
    </div>
  `;
}


function applyTicketFilters() {
  window.ticketSearch =
    val('ticketSearch').trim();

  window.ticketStatus =
    val('ticketStatusFilter');

  window.ticketSeverity =
    val('ticketSeverityFilter');

  renderTickets(1);
}


function resetTicketFilters() {
  window.ticketSearch = '';
  window.ticketStatus = '';
  window.ticketSeverity = '';

  renderTickets(1);
}


async function loadTicketDevices() {
  const [dc, site] = await Promise.all([
    gas(
      'listDevices',
      state.token,
      {
        page:1,
        pageSize:5000,
        scope:'DC'
      }
    ),

    gas(
      'listDevices',
      state.token,
      {
        page:1,
        pageSize:5000,
        scope:'SITE'
      }
    )
  ]);

  const rows = [
    ...(dc?.success
      ? dc.data?.rows || []
      : []),

    ...(site?.success
      ? site.data?.rows || []
      : [])
  ];

  window.ticketDeviceOptions = rows;
  return rows;
}


async function openTicketForm(id = '') {
  if (!ticketCanManage()) {
    return toast(
      'Anda tidak memiliki izin mengelola tiket.',
      'error'
    );
  }

  try {
    let x =
      (window.ticketRows || [])
        .find(
          row =>
            String(row.TicketID) ===
            String(id)
        ) || {};

    if (id && !x.TicketID) {
      const detail = await gas(
        'getIncidentTicket',
        state.token,
        id
      );

      err(detail);

      x = detail.data.ticket || {};
    }

    await loadTicketDevices();

    const sites =
      (state.master?.sites || [])
        .filter(
          site =>
            String(site.Status || '')
              .toUpperCase() ===
            'ACTIVE'
        )
        .sort((a, b) =>
          String(
            a.NamaKota || ''
          ).localeCompare(
            String(
              b.NamaKota || ''
            ),
            'id'
          ) ||
          String(
            a.KodeSite || ''
          ).localeCompare(
            String(
              b.KodeSite || ''
            ),
            'id'
          )
        );

    const cities = [
      ...new Set(
        sites
          .map(s =>
            String(
              s.NamaKota || ''
            ).trim()
          )
          .filter(Boolean)
      )
    ].sort(
      (a, b) =>
        a.localeCompare(
          b,
          'id'
        )
    );

    window.ticketEditDeviceId =
      x.DeviceID || '';

    modal(
      id
        ? `Edit Tiket ${esc(x.TicketNumber || '')}`
        : 'Buat Tiket Gangguan',

      `
      <form
        id="ticketForm"
        class="row g-3"
      >
        <input
          type="hidden"
          name="TicketID"
          value="${esc(x.TicketID || '')}"
        >

        <input
          type="hidden"
          id="ticketDeviceName"
          name="DeviceName"
          value="${esc(x.DeviceName || '')}"
        >

        <div class="col-md-8">
          <label class="form-label">
            Judul Gangguan
          </label>

          <input
            name="Title"
            class="form-control"
            value="${esc(x.Title || '')}"
            placeholder="Contoh: Link POP Pule Down"
            required
          >
        </div>

        <div class="col-md-4">
          <label class="form-label">
            Severity / Priority
          </label>

          <select
            name="Severity"
            class="form-select"
            required
          >
            ${TICKET_SEVERITIES.map(v => `
              <option
                value="${v}"
                ${
                  (x.Severity || 'P3 - MEDIUM') === v
                    ? 'selected'
                    : ''
                }
              >
                ${v}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label">
            Kategori Gangguan
          </label>

          <select
            name="Category"
            class="form-select"
            required
          >
            <option value="">
              Pilih Kategori
            </option>

            ${TICKET_CATEGORIES.map(v => `
              <option
                value="${v}"
                ${x.Category === v ? 'selected' : ''}
              >
                ${v}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label">
            Waktu Mulai Gangguan
          </label>

          <input
            name="IncidentStart"
            type="datetime-local"
            class="form-control"
            value="${esc(
              String(
                x.IncidentStart || ''
              ).substring(0, 16)
            )}"
            required
          >
        </div>

        <div class="col-md-4">
          <label class="form-label">
            Nama Kota
          </label>

          <input
            id="ticketCity"
            name="City"
            class="form-control"
            list="ticketCityList"
            value="${esc(x.City || '')}"
            placeholder="Contoh: Trenggalek"
            required
          >

          <datalist id="ticketCityList">
            ${cities.map(city => `
              <option value="${esc(city)}"></option>
            `).join('')}
          </datalist>
        </div>

        <div class="col-md-4">
          <label class="form-label">
            Site / POP / Data Center
          </label>

          <select
            id="ticketSite"
            name="SiteCode"
            class="form-select"
            onchange="syncTicketSiteFields()"
            required
          >
            <option value="">
              Pilih Site
            </option>

            ${sites.map(s => `
              <option
                value="${esc(s.KodeSite)}"
                data-city="${esc(s.NamaKota || '')}"
                ${
                  String(x.SiteCode || '') ===
                  String(s.KodeSite || '')
                    ? 'selected'
                    : ''
                }
              >
                ${esc(s.NamaKota || '-')}
                •
                ${esc(s.KodeSite)}
                -
                ${esc(s.NamaSite)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="col-md-4">
          <label class="form-label">
            Device Terkait
          </label>

          <select
            id="ticketDevice"
            name="DeviceID"
            class="form-select"
            onchange="syncTicketDeviceName()"
          >
            <option value="">
              Tidak ada / Pilih Device
            </option>
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label">
            Layanan / Link Terdampak
          </label>

          <input
            name="AffectedService"
            class="form-control"
            value="${esc(x.AffectedService || '')}"
            placeholder="Contoh: PTP Trenggalek <> Pule"
          >
        </div>

        <div class="col-md-6">
          <label class="form-label">
            PIC / Assigned To
          </label>

          <input
            name="AssignedTo"
            class="form-control"
            value="${esc(x.AssignedTo || '')}"
            placeholder="Contoh: Viky / NOC"
            required
          >
        </div>

        <div class="col-12">
          <label class="form-label">
            Deskripsi Gangguan
          </label>

          <textarea
            name="Description"
            class="form-control"
            rows="3"
            placeholder="Jelaskan kondisi awal, alarm, hasil monitoring, dll."
            required
          >${esc(x.Description || '')}</textarea>
        </div>

        <div class="col-12">
          <label class="form-label">
            Dampak
          </label>

          <textarea
            name="Impact"
            class="form-control"
            rows="3"
            placeholder="Contoh: Pelanggan area Pule mengalami loss koneksi."
            required
          >${esc(x.Impact || '')}</textarea>
        </div>
      </form>
      `,

      `
      <button
        class="btn btn-light"
        data-bs-dismiss="modal"
      >
        Batal
      </button>

      <button
        class="btn btn-primary"
        onclick="submitTicket()"
      >
        <i class="bi bi-check-lg me-1"></i>
        Simpan Tiket
      </button>
      `
    );

    syncTicketSiteFields();

  } catch (e) {
    toast(
      e.message ||
      'Form tiket gagal dibuka.',
      'error'
    );
  }
}


function syncTicketSiteFields() {
  const siteEl =
    document.getElementById(
      'ticketSite'
    );

  const cityEl =
    document.getElementById(
      'ticketCity'
    );

  const deviceEl =
    document.getElementById(
      'ticketDevice'
    );

  if (!siteEl || !deviceEl) return;

  const option =
    siteEl.options[
      siteEl.selectedIndex
    ];

  const city =
    option?.dataset?.city || '';

  if (
    cityEl &&
    city &&
    !cityEl.value.trim()
  ) {
    cityEl.value = city;
  }

  if (
    cityEl &&
    city
  ) {
    /*
     * Kota mengikuti master Site jika NamaKota tersedia.
     * Ini mencegah kombinasi tidak konsisten seperti
     * Jakarta + Site Trenggalek.
     */
    cityEl.value = city;
  }

  const siteCode =
    siteEl.value;

  const devices =
    (window.ticketDeviceOptions || [])
      .filter(
        d =>
          !siteCode ||
          String(d.SiteCode || '') ===
          String(siteCode)
      )
      .sort(
        (a, b) =>
          String(
            a.NamaDevice || ''
          ).localeCompare(
            String(
              b.NamaDevice || ''
            ),
            'id'
          )
      );

  const selectedId =
    window.ticketEditDeviceId || '';

  deviceEl.innerHTML = `
    <option value="">
      Tidak ada / Pilih Device
    </option>

    ${devices.map(d => `
      <option
        value="${esc(d.DeviceID)}"
        data-name="${esc(d.NamaDevice || '')}"
        ${
          String(d.DeviceID) ===
          String(selectedId)
            ? 'selected'
            : ''
        }
      >
        ${esc(d.NamaDevice || '-')}
        ${d.IPAddress
          ? ` • ${esc(d.IPAddress)}`
          : ''}
      </option>
    `).join('')}
  `;

  window.ticketEditDeviceId = '';

  syncTicketDeviceName();
}


function syncTicketDeviceName() {
  const deviceEl =
    document.getElementById(
      'ticketDevice'
    );

  const nameEl =
    document.getElementById(
      'ticketDeviceName'
    );

  if (!deviceEl || !nameEl) return;

  const option =
    deviceEl.options[
      deviceEl.selectedIndex
    ];

  nameEl.value =
    option?.dataset?.name || '';
}


async function submitTicket() {
  const form =
    document.getElementById(
      'ticketForm'
    );

  if (
    !form ||
    !form.reportValidity()
  ) {
    return;
  }

  const saveBtn =
    document.querySelector(
      '#modalFooter .btn-primary'
    );

  busy(saveBtn, true);

  try {
    syncTicketDeviceName();

    const payload =
      obj(form);

    console.log(
      'submitTicket payload:',
      payload
    );

    const r = await gas(
      'saveIncidentTicket',
      state.token,
      payload
    );

    console.log(
      'saveIncidentTicket response:',
      r
    );

    if (!r) {
      throw new Error(
        'Backend tidak memberikan response. ' +
        'Pastikan deployment Web App sudah menggunakan versi terbaru.'
      );
    }

    if (!r.success) {
      throw new Error(
        r.message ||
        r.error ||
        'Backend menolak penyimpanan tiket tanpa memberikan detail error.'
      );
    }

    toast(
      r.message ||
      'Tiket berhasil disimpan.'
    );

    closeModal();

    await renderTickets(1);

  } catch (e) {
    console.error(
      'submitTicket ERROR:',
      e
    );

    const message =
      e?.message ||
      e?.details ||
      String(e) ||
      'Tiket gagal disimpan.';

    toast(
      message,
      'error'
    );

  } finally {
    busy(saveBtn, false);
  }
}


async function openTicketProgress(ticketId) {
  if (!ticketCanManage()) {
    return;
  }

  try {
    const detail = await gas(
      'getIncidentTicket',
      state.token,
      ticketId
    );

    err(detail);

    const x =
      detail.data.ticket || {};

    const nowLocal =
      new Date(
        Date.now() -
        new Date().getTimezoneOffset() *
        60000
      )
        .toISOString()
        .slice(0, 16);

    modal(
      `Update ${esc(x.TicketNumber || 'Tiket')}`,

      `
      <form
        id="ticketProgressForm"
        class="row g-3"
      >
        <div class="col-md-6">
          <label class="form-label">
            Status
          </label>

          <select
            id="ticketProgressStatus"
            name="Status"
            class="form-select"
            onchange="syncTicketProgressFields()"
            required
          >
            ${TICKET_STATUSES.map(v => `
              <option
                value="${v}"
                ${x.Status === v ? 'selected' : ''}
              >
                ${v}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label">
            PIC
          </label>

          <input
            class="form-control"
            value="${esc(x.AssignedTo || '-')}"
            disabled
          >
        </div>

        <div class="col-12">
          <label class="form-label">
            Action / Penanganan
          </label>

          <textarea
            name="ActionTaken"
            class="form-control"
            rows="3"
            placeholder="Tindakan yang dilakukan..."
          >${esc(x.ActionTaken || '')}</textarea>
        </div>

        <div class="col-12">
          <label class="form-label">
            Root Cause
          </label>

          <textarea
            name="RootCause"
            class="form-control"
            rows="3"
            placeholder="Penyebab gangguan, jika sudah diketahui..."
          >${esc(x.RootCause || '')}</textarea>
        </div>

        <div
          id="ticketResolvedWrap"
          class="col-md-6"
        >
          <label class="form-label">
            Waktu Normal / Resolved
          </label>

          <input
            id="ticketResolvedAt"
            name="ResolvedAt"
            type="datetime-local"
            class="form-control"
            value="${esc(
              String(
                x.ResolvedAt || ''
              ).substring(0, 16) ||
              nowLocal
            )}"
          >
        </div>

        <div
          id="ticketClosedWrap"
          class="col-md-6"
        >
          <label class="form-label">
            Waktu Closed
          </label>

          <input
            id="ticketClosedAt"
            name="ClosedAt"
            type="datetime-local"
            class="form-control"
            value="${esc(
              String(
                x.ClosedAt || ''
              ).substring(0, 16) ||
              nowLocal
            )}"
          >
        </div>

        <div class="col-12">
          <label class="form-label">
            Catatan Update
          </label>

          <textarea
            name="Note"
            class="form-control"
            rows="2"
            placeholder="Catatan tambahan / hasil koordinasi..."
          ></textarea>
        </div>
      </form>
      `,

      `
      <button
        class="btn btn-light"
        data-bs-dismiss="modal"
      >
        Batal
      </button>

      <button
        class="btn btn-primary"
        onclick="submitTicketProgress('${ticketId}')"
      >
        <i class="bi bi-activity me-1"></i>
        Update Progress
      </button>
      `
    );

    syncTicketProgressFields();

  } catch (e) {
    toast(
      e.message ||
      'Detail tiket gagal dimuat.',
      'error'
    );
  }
}


function syncTicketProgressFields() {
  const status =
    val('ticketProgressStatus');

  const resolved =
    document.getElementById(
      'ticketResolvedWrap'
    );

  const closed =
    document.getElementById(
      'ticketClosedWrap'
    );

  if (resolved) {
    resolved.classList.toggle(
      'hidden',
      ![
        'RESOLVED',
        'CLOSED'
      ].includes(status)
    );
  }

  if (closed) {
    closed.classList.toggle(
      'hidden',
      status !== 'CLOSED'
    );
  }
}


async function submitTicketProgress(ticketId) {
  const form =
    document.getElementById(
      'ticketProgressForm'
    );

  if (
    !form ||
    !form.reportValidity()
  ) {
    return;
  }

  try {
    const r = await gas(
      'updateIncidentTicketProgress',
      state.token,
      ticketId,
      obj(form)
    );

    err(r);

    toast(
      r.message ||
      'Progress tiket diperbarui.'
    );

    closeModal();
    await renderTickets(1);

  } catch (e) {
    toast(
      e.message ||
      'Progress tiket gagal diperbarui.',
      'error'
    );
  }
}


async function openTicketDetail(ticketId) {
  try {
    const r = await gas(
      'getIncidentTicket',
      state.token,
      ticketId
    );

    err(r);

    const x = r.data.ticket || {};
    const updates =
      r.data.updates || [];

    modal(
      `Detail ${esc(x.TicketNumber || 'Tiket')}`,

      `
      <div class="ticket-detail">
        <div class="ticket-detail-hero">
          <div>
            <div class="d-flex gap-2 align-items-center flex-wrap">
              ${ticketSeverityBadge(x.Severity)}
              ${ticketStatusBadge(x.Status)}
            </div>

            <h4>
              ${esc(x.Title || '-')}
            </h4>

            <div class="ticket-detail-meta">
              Dilaporkan:
              ${ticketFormatDateTime(x.ReportedAt)}
              •
              PIC:
              ${esc(x.AssignedTo || '-')}
            </div>
          </div>

          <div class="ticket-detail-number">
            ${esc(x.TicketNumber || '-')}
          </div>
        </div>

        <div class="ticket-detail-grid">
          ${ticketDetailItem(
            'Kota',
            x.City || '-'
          )}

          ${ticketDetailItem(
            'Site',
            x.SiteCode || '-'
          )}

          ${ticketDetailItem(
            'Device',
            x.DeviceName || '-'
          )}

          ${ticketDetailItem(
            'Kategori',
            x.Category || '-'
          )}

          ${ticketDetailItem(
            'Mulai Gangguan',
            ticketFormatDateTime(
              x.IncidentStart
            )
          )}

          ${ticketDetailItem(
            'Waktu Normal',
            ticketFormatDateTime(
              x.ResolvedAt
            )
          )}

          ${ticketDetailItem(
            'Durasi',
            ticketDurationText(
              x.DurationMinutes
            )
          )}

          ${ticketDetailItem(
            'Layanan Terdampak',
            x.AffectedService || '-'
          )}
        </div>

        <div class="ticket-detail-section">
          <h6>DESKRIPSI GANGGUAN</h6>
          <p>${esc(x.Description || '-')}</p>
        </div>

        <div class="ticket-detail-section">
          <h6>DAMPAK</h6>
          <p>${esc(x.Impact || '-')}</p>
        </div>

        <div class="ticket-detail-section">
          <h6>ACTION / PENANGANAN TERAKHIR</h6>
          <p>${esc(x.ActionTaken || '-')}</p>
        </div>

        <div class="ticket-detail-section">
          <h6>ROOT CAUSE</h6>
          <p>${esc(x.RootCause || '-')}</p>
        </div>

        <div class="ticket-detail-section">
          <div class="ticket-history-head">
            <h6>HISTORI UPDATE</h6>
            <span>${updates.length} update</span>
          </div>

          <div class="ticket-timeline">
            ${updates.length
              ? updates.map(u => `
                  <div class="ticket-timeline-item">
                    <div class="ticket-timeline-dot"></div>

                    <div class="ticket-timeline-body">
                      <div class="ticket-timeline-top">
                        ${ticketStatusBadge(u.Status)}

                        <span>
                          ${ticketFormatDateTime(u.Timestamp)}
                        </span>
                      </div>

                      ${
                        u.ActionTaken
                          ? `
                            <p>
                              <strong>Action:</strong>
                              ${esc(u.ActionTaken)}
                            </p>
                          `
                          : ''
                      }

                      ${
                        u.RootCause
                          ? `
                            <p>
                              <strong>Root Cause:</strong>
                              ${esc(u.RootCause)}
                            </p>
                          `
                          : ''
                      }

                      ${
                        u.Note
                          ? `
                            <p>
                              ${esc(u.Note)}
                            </p>
                          `
                          : ''
                      }

                      <small>
                        Updated by
                        ${esc(u.UpdatedBy || '-')}
                      </small>
                    </div>
                  </div>
                `).join('')
              : `
                <div class="text-secondary">
                  Belum ada histori update.
                </div>
              `
            }
          </div>
        </div>
      </div>
      `,

      `
      <button
        class="btn btn-light"
        data-bs-dismiss="modal"
      >
        Tutup
      </button>

      ${ticketCanManage() ? `
        <button
          class="btn btn-primary"
          onclick="
            closeModal();
            openTicketProgress('${ticketId}');
          "
        >
          <i class="bi bi-activity me-1"></i>
          Update Progress
        </button>
      ` : ''}
      `
    );

  } catch (e) {
    toast(
      e.message ||
      'Detail tiket gagal dimuat.',
      'error'
    );
  }
}


function ticketDetailItem(label, value) {
  return `
    <div class="ticket-detail-item">
      <span>${esc(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}


async function deleteTicketUI(ticketId) {
  if (!ticketCanDelete()) {
    return;
  }

  const ticket =
    (window.ticketRows || [])
      .find(
        x =>
          String(x.TicketID) ===
          String(ticketId)
      );

  const label =
    ticket?.TicketNumber ||
    ticketId;

  if (
    !confirm(
      `Hapus tiket "${label}"?\n\n` +
      'Tiket akan di-soft-delete dan histori tetap tersimpan.'
    )
  ) {
    return;
  }

  try {
    const r = await gas(
      'deactivateIncidentTicket',
      state.token,
      ticketId
    );

    err(r);

    toast(
      r.message ||
      'Tiket berhasil dihapus.'
    );

    await renderTickets(1);

  } catch (e) {
    toast(
      e.message ||
      'Tiket gagal dihapus.',
      'error'
    );
  }
}


async function renderMovements(page=1){setTitle('Movement History','Histori perpindahan perangkat');loading();const r=await gas('listMovements',state.token,{page,pageSize:20});err(r);const d=r.data;$('#content').innerHTML=`<div class="mb-3"><h1 class="page-title">Movement History</h1></div><div class="cardx">${table(['Tanggal','Device ID','Type','From','To','Reference','Keterangan'],d.rows.map(x=>`<tr><td>${esc(x.Tanggal)}</td><td>${esc(x.DeviceID)}</td><td>${badge(x.MovementType)}</td><td>${esc(x.FromSite)} / ${esc(x.FromRack)}</td><td>${esc(x.ToSite)} / ${esc(x.ToRack)}</td><td>${esc(x.ReferenceID)}</td><td>${esc(x.Keterangan)}</td></tr>`).join(''))}${pager(d,'renderMovements')}</div>`}

async function renderUsers(page=1){setTitle('User Management','Kelola akses aplikasi');loading();const r=await gas('listUsers',state.token,{page,pageSize:20});err(r);const d=r.data;window.userRows=d.rows;$('#content').innerHTML=`<div class="toolbar mb-3"><h1 class="page-title">Users</h1>${can('users.manage')?'<button class="btn btn-primary" onclick="openUserForm()"><i class="bi bi-plus-lg"></i> Tambah User</button>':''}</div><div class="cardx">${table(['Username','Nama','Email','Role','Divisi','Status','Aksi'],d.rows.map(x=>`<tr><td>${esc(x.Username)}</td><td>${esc(x.Nama)}</td><td>${esc(x.Email)}</td><td>${badge(x.Role)}</td><td>${esc(x.Divisi)}</td><td>${badge(x.Status)}</td><td><button class="btn btn-sm btn-light" onclick="openUserForm('${x.UserID}')"><i class="bi bi-pencil"></i></button></td></tr>`).join(''))}${pager(d,'renderUsers')}</div>`}
function openUserForm(id=''){const x=(window.userRows||[]).find(a=>a.UserID===id)||{};modal(id?'Edit User':'Tambah User',`<form id="userForm" class="row g-3"><input type="hidden" name="UserID" value="${esc(x.UserID||'')}"><div class="col-md-6"><label class="form-label">Username</label><input name="Username" class="form-control" value="${esc(x.Username||'')}" required></div><div class="col-md-6"><label class="form-label">Nama</label><input name="Nama" class="form-control" value="${esc(x.Nama||'')}" required></div><div class="col-md-6"><label class="form-label">Email</label><input name="Email" type="email" class="form-control" value="${esc(x.Email||'')}"></div><div class="col-md-6"><label class="form-label">Divisi</label><input name="Divisi" class="form-control" value="${esc(x.Divisi||'')}"></div><div class="col-md-6"><label class="form-label">Role</label><select name="Role" class="form-select">${['SUPER_ADMIN','ADMIN','NOC','APPROVER','VIEWER'].map(v=>`<option ${x.Role===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="col-md-6"><label class="form-label">Status</label><select name="Status" class="form-select"><option>ACTIVE</option><option ${x.Status==='INACTIVE'?'selected':''}>INACTIVE</option></select></div><div class="col-12"><label class="form-label">${id?'Password Baru (opsional)':'Password Awal'}</label><input name="NewPassword" type="password" class="form-control" ${id?'':'required'} minlength="8"></div></form>`,`<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary" onclick="submitUser()">Simpan</button>`)}
async function submitUser(){const f=$('#userForm');if(!f.reportValidity())return;const r=await gas('saveUser',state.token,obj(f));if(!r.success)return toast(r.message,'error');toast(r.message);closeModal();renderUsers(1)}

async function renderAudit(page=1){setTitle('Audit Log','Jejak aktivitas sistem');loading();const r=await gas('listAuditLogs',state.token,{page,pageSize:30});err(r);const d=r.data;$('#content').innerHTML=`<div class="mb-3"><h1 class="page-title">Audit Log</h1></div><div class="cardx">${table(['Waktu','User','Action','Module','Reference','Description'],d.rows.map(x=>`<tr><td>${esc(x.Timestamp)}</td><td>${esc(x.Username)}</td><td>${esc(x.Action)}</td><td>${esc(x.Module)}</td><td>${esc(x.ReferenceID)}</td><td>${esc(x.Description)}</td></tr>`).join(''))}${pager(d,'renderAudit')}</div>`}

async function renderSettings(){setTitle('Settings','Konfigurasi aplikasi');loading();const r=await gas('getSettings',state.token);err(r);$('#content').innerHTML=`<div class="mb-3"><h1 class="page-title">Settings</h1></div><div class="cardx">${table(['Key','Value','Description','Updated'],r.data.map(x=>`<tr><td><strong>${esc(x.Key)}</strong></td><td>${esc(x.Value)}</td><td>${esc(x.Description)}</td><td>${esc(x.UpdatedAt)}</td></tr>`).join(''))}</div>`}


function openForgotPassword(){
  modal(
    'Lupa Password',
    `<div class="reset-intro mb-3"><div class="reset-icon"><i class="bi bi-shield-lock"></i></div><div><strong>Reset password akun</strong><div class="text-secondary small">Masukkan username atau email yang terdaftar. Kode verifikasi akan dikirim ke email akun.</div></div></div>
     <form id="forgotForm">
       <label class="form-label">Username / Email</label>
       <input id="forgotIdentifier" class="form-control" autocomplete="username" required placeholder="contoh: viky atau nama@menaksopal.net.id">
     </form>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button id="forgotSendBtn" class="btn btn-primary" onclick="submitForgotPasswordRequest()"><i class="bi bi-send me-1"></i>Kirim Kode</button>`
  );
}

async function submitForgotPasswordRequest(){
  const f=document.getElementById('forgotForm');
  if(!f?.reportValidity()) return;
  const identifier=val('forgotIdentifier').trim();
  const btn=document.getElementById('forgotSendBtn');
  busy(btn,true);
  try{
    const r=await gas('requestPasswordReset',identifier);
    if(!r?.success) throw new Error(r?.message||'Permintaan reset gagal.');
    toast(r.message||'Jika akun ditemukan, kode reset telah dikirim.');
    openForgotPasswordConfirm(identifier);
  }catch(e){toast(e.message||'Permintaan reset gagal.','error')}
  finally{busy(btn,false)}
}

function openForgotPasswordConfirm(identifier){
  modal(
    'Verifikasi Reset Password',
    `<div class="alert alert-light border small">Kode berlaku 10 menit. Periksa inbox/spam email akun.</div>
     <form id="resetConfirmForm" class="row g-3">
       <input id="resetIdentifier" type="hidden" value="${esc(identifier)}">
       <div class="col-12"><label class="form-label">Kode Verifikasi</label><input id="resetCode" class="form-control reset-code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></div>
       <div class="col-12"><label class="form-label">Password Baru</label><input id="resetNewPassword" type="password" class="form-control" minlength="8" autocomplete="new-password" required></div>
       <div class="col-12"><label class="form-label">Ulangi Password Baru</label><input id="resetNewPassword2" type="password" class="form-control" minlength="8" autocomplete="new-password" required></div>
     </form>`,
    `<button class="btn btn-light" onclick="openForgotPassword()">Kembali</button><button id="resetConfirmBtn" class="btn btn-primary" onclick="submitForgotPasswordConfirm()"><i class="bi bi-key me-1"></i>Reset Password</button>`
  );
}

async function submitForgotPasswordConfirm(){
  const f=document.getElementById('resetConfirmForm');
  if(!f?.reportValidity()) return;
  const identifier=val('resetIdentifier').trim();
  const code=val('resetCode').trim();
  const password=val('resetNewPassword');
  const password2=val('resetNewPassword2');
  if(password!==password2) return toast('Konfirmasi password tidak sama.','error');
  const btn=document.getElementById('resetConfirmBtn');
  busy(btn,true);
  try{
    const r=await gas('confirmPasswordReset',identifier,code,password);
    if(!r?.success) throw new Error(r?.message||'Reset password gagal.');
    toast('Password berhasil diubah. Silakan login.');
    closeModal();
    showLogin();
  }catch(e){toast(e.message||'Reset password gagal.','error')}
  finally{busy(btn,false)}
}

function openChangePassword(){modal('Ganti Password',`<form id="pwdForm" class="row g-3"><div class="col-12"><label class="form-label">Password Saat Ini</label><input id="pwdCurrent" type="password" class="form-control" required></div><div class="col-12"><label class="form-label">Password Baru</label><input id="pwdNew" type="password" minlength="8" class="form-control" required></div></form>`,`<button class="btn btn-primary" onclick="submitPassword()">Simpan Password</button>`)}
async function submitPassword(){const f=$('#pwdForm');if(!f.reportValidity())return;const r=await gas('changeMyPassword',state.token,val('pwdCurrent'),val('pwdNew'));if(!r.success)return toast(r.message,'error');toast(r.message);closeModal()}
