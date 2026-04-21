/* ================================================================
   2. API MICROSOFT GRAPH — FONCTIONS D'ACCÈS SHAREPOINT
   ================================================================ */
async function graphFetch(path, method = 'GET', body = null) {
  const url = path.startsWith("https://") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const opts = {
    method,
    headers: { Authorization: `Bearer ${graphToken}`, "Content-Type": "application/json" }
  };
  if (body && method !== 'GET' && method !== 'DELETE') {
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  if (method === 'DELETE') return resp.ok ? {} : (() => { throw new Error('Delete failed ' + resp.status); })();
  if (!resp.ok) throw new Error(`Graph API error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function getSiteId() {
  const data = await graphFetch(`/sites/${SP_CONFIG.tenantDomain}:${SP_CONFIG.siteRelativeUrl}`);
  return data.id;
}

async function getListItems(listName) {
  const data = await graphFetch(
    `/sites/${spSiteId}/lists/${listName}/items?expand=fields($select=*)&$top=500`
  );
  return data.value.map(item => item.fields);
}
