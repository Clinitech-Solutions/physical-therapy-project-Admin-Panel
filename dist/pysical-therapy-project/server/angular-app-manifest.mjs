
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "redirectTo": "/login",
    "route": "/"
  },
  {
    "renderMode": 2,
    "route": "/login"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-XIDN4PKG.js"
    ],
    "route": "/receptionist"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-7RTQB4J4.js"
    ],
    "route": "/senior"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-ODCFZY3H.js"
    ],
    "route": "/doctor"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-DNJVASSG.js"
    ],
    "route": "/ceo"
  },
  {
    "renderMode": 2,
    "redirectTo": "/login",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 24568, hash: '03a9c90ad7d26901f7a7bfb7560164510efdd9433a2057289bc59c524e9c978e', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1062, hash: '74fd4043beccca1000d4ec8a036327cf4a021d50b597b39fa97c07bf7f26674b', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'login/index.html': {size: 24690, hash: '2a5f1e0a25b6559e47c4c57fa70f8be42a9a4a3b404011d416f79c9889ac8578', text: () => import('./assets-chunks/login_index_html.mjs').then(m => m.default)},
    'senior/index.html': {size: 24743, hash: '07c6e52114817a207a338ae83fbe1d6254e2fa775112015eec3e389bcf1cd859', text: () => import('./assets-chunks/senior_index_html.mjs').then(m => m.default)},
    'ceo/index.html': {size: 24743, hash: '454040418f039e28b7ad0b3f1cb630f0d8559a0cb7824fbb572b30f437ec30a9', text: () => import('./assets-chunks/ceo_index_html.mjs').then(m => m.default)},
    'doctor/index.html': {size: 24743, hash: 'cebb26178239f5cdb42cd3389af63029f5f11b5f1c5c1a35f26cd3abc7e89f43', text: () => import('./assets-chunks/doctor_index_html.mjs').then(m => m.default)},
    'receptionist/index.html': {size: 24743, hash: '3dc09cac952b22b5d007e0c301ca2b1633fbf40c650d9ebc70f7ddc5942df545', text: () => import('./assets-chunks/receptionist_index_html.mjs').then(m => m.default)},
    'styles-DFNXKMVR.css': {size: 439299, hash: '8w+S0vVa8KQ', text: () => import('./assets-chunks/styles-DFNXKMVR_css.mjs').then(m => m.default)}
  },
};
