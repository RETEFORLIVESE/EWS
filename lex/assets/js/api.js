const API = {
  _check() {
    if (
      !API_CONFIG.binId ||
      API_CONFIG.binId === "IL_TUO_BIN_ID" ||
      !API_CONFIG.apiKey ||
      API_CONFIG.apiKey === "LA_TUA_MASTER_KEY"
    ) {
      throw new Error("Configura binId e apiKey in assets/js/config.js");
    }
  },

  async loadAtti() {
    this._check();
    const res = await fetch(
      `${API_CONFIG.baseUrl}/${API_CONFIG.binId}/latest`,
      {
        headers: {
          "X-Master-Key": API_CONFIG.apiKey,
          "X-Bin-Meta": "false",
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const record = data.record || data;
    return Array.isArray(record[API_CONFIG.key]) ? record[API_CONFIG.key] : [];
  },

  async saveAtti(atti) {
    this._check();
    const res = await fetch(`${API_CONFIG.baseUrl}/${API_CONFIG.binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_CONFIG.apiKey,
      },
      body: JSON.stringify({ [API_CONFIG.key]: atti }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  },
};
