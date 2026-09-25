const storageKey = "wxyy-2-thin-section-index";
const libraryFormat = "thin-section-library";

const form = document.querySelector("#sampleForm");
const photoInput = document.querySelector("#photoInput");
const sampleGrid = document.querySelector("#sampleGrid");
const comparePane = document.querySelector("#comparePane");
const mineralFilter = document.querySelector("#mineralFilter");
const polarFilter = document.querySelector("#polarFilter");
const importInput = document.querySelector("#importInput");
const notice = document.querySelector("#notice");

let pendingPhoto = "";
let noticeTimer = 0;

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function showNotice(message, type = "success") {
  notice.textContent = message;
  notice.dataset.type = type;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 8000);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.readAsDataURL(file);
  });
}

function pickField(raw, keys) {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

// 统一归到当前样本结构；同时兼容旧版导出的中文键清单
function normalizeSample(raw, regenerateId = false) {
  if (!raw || typeof raw !== "object") return null;
  const code = pickField(raw, ["code", "样本编号"]);
  if (!code) return null;
  const id = !regenerateId && typeof raw.id === "string" && raw.id
    ? raw.id
    : crypto.randomUUID();
  return {
    id,
    photo: typeof raw.photo === "string" ? raw.photo : "",
    code,
    location: pickField(raw, ["location", "采样地点"]),
    magnification: pickField(raw, ["magnification", "放大倍数"]),
    polarization: pickField(raw, ["polarization", "偏光类型"]) || "单偏光",
    minerals: pickField(raw, ["minerals", "主要矿物"]),
    texture: pickField(raw, ["texture", "颗粒结构"]),
    comment: pickField(raw, ["comment", "老师批注"]),
    createdAt: typeof raw.createdAt === "string" && raw.createdAt
      ? raw.createdAt
      : new Date().toISOString()
  };
}

function loadState() {
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    parsed = {};
  }
  const samples = Array.isArray(parsed.samples)
    ? parsed.samples.map((raw) => normalizeSample(raw)).filter(Boolean)
    : [];
  const ids = new Set(samples.map((sample) => sample.id));
  const compare = (Array.isArray(parsed.compare) ? parsed.compare : [])
    .filter((id) => ids.has(id))
    .slice(0, 2);
  return { samples, compare };
}

const state = loadState();

// 多个矿物名用顿号、逗号、分号、空格或斜杠分隔，样本需同时包含全部矿物
function parseMineralTerms(value) {
  return value.split(/[、,，;；\s/]+/).map((term) => term.trim()).filter(Boolean);
}

function filteredSamples() {
  const terms = parseMineralTerms(mineralFilter.value);
  const polarization = polarFilter.value;
  return state.samples.filter((sample) => {
    const mineralMatch = terms.every((term) => sample.minerals.includes(term));
    const polarMatch = !polarization || sample.polarization === polarization;
    return mineralMatch && polarMatch;
  });
}

function renderCompareItem(sample) {
  return `
    <article class="compare-item">
      ${sample.photo
        ? `<img src="${sample.photo}" alt="${sample.code}对比图">`
        : '<div class="photo-placeholder"></div>'}
      <h3>${sample.code}</h3>
      <p class="compare-meta">${sample.polarization} · ${sample.minerals || "未记录矿物"}</p>
      <p><span class="field-label">结构描述</span>${sample.texture || "未记录"}</p>
      <p><span class="field-label">老师批注</span>${sample.comment || "未填写批注"}</p>
    </article>
  `;
}

function render() {
  const rows = filteredSamples();

  if (!rows.length) {
    if (!state.samples.length) {
      sampleGrid.innerHTML = '<p class="grid-empty">还没有样本，先从左侧录入薄片照片，或用右上角「导入样本库」整包导入。</p>';
    } else {
      const terms = parseMineralTerms(mineralFilter.value);
      const reason = terms.length > 1
        ? `没有同时包含「${terms.join("、")}」全部矿物的样本`
        : "没有符合当前筛选条件的样本";
      sampleGrid.innerHTML = `<p class="grid-empty">${reason}，试试减少矿物名或更换偏光类型。</p>`;
    }
  } else {
    sampleGrid.innerHTML = rows.map((sample) => `
      <article class="sample-card">
        ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}显微照片">` : '<div class="photo-placeholder"></div>'}
        <div class="sample-body">
          <h3>${sample.code}</h3>
          <p>${sample.location || "未记录地点"} · ${sample.magnification || "未记录倍数"} · ${sample.polarization}</p>
          <p>矿物：${sample.minerals || "未记录"}</p>
          <p>结构：${sample.texture || "未记录"}</p>
          <p>${sample.comment || "未填写批注"}</p>
          <div class="card-actions">
            <label><input type="checkbox" data-compare="${sample.id}" ${state.compare.includes(sample.id) ? "checked" : ""}>对比</label>
            <button type="button" data-delete="${sample.id}">删除</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  const compareSamples = state.compare
    .map((id) => state.samples.find((sample) => sample.id === id))
    .filter(Boolean)
    .slice(0, 2);

  if (!compareSamples.length) {
    comparePane.innerHTML = '<p class="compare-empty">勾选两张样本卡片后可并排对比。</p>';
  } else {
    comparePane.innerHTML = compareSamples.map(renderCompareItem).join("");
    if (compareSamples.length === 1) {
      comparePane.innerHTML += `
        <article class="compare-item compare-slot">
          <div class="photo-placeholder"></div>
          <h3>待补选</h3>
          <p>请再勾选一张样本补全对比。</p>
        </article>
        <p class="compare-hint">另一侧样本已保留，勾选一张新样本即可继续两张对比。</p>`;
    }
  }
}

photoInput.addEventListener("change", async () => {
  pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (!pendingPhoto && photoInput.files[0]) {
    pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  }
  state.samples.unshift({
    id: crypto.randomUUID(),
    photo: pendingPhoto,
    code: data.get("code").trim(),
    location: data.get("location").trim(),
    magnification: data.get("magnification").trim(),
    polarization: data.get("polarization"),
    minerals: data.get("minerals").trim(),
    texture: data.get("texture").trim(),
    comment: data.get("comment").trim(),
    createdAt: new Date().toISOString()
  });
  pendingPhoto = "";
  photoInput.value = "";
  form.reset();
  save();
  render();
});

sampleGrid.addEventListener("click", (event) => {
  const deleteId = event.target.dataset.delete;
  if (deleteId) {
    state.samples = state.samples.filter((sample) => sample.id !== deleteId);
    state.compare = state.compare.filter((id) => id !== deleteId);
    save();
    render();
  }
});

sampleGrid.addEventListener("change", (event) => {
  const id = event.target.dataset.compare;
  if (!id) return;
  if (event.target.checked) {
    state.compare = [id, ...state.compare.filter((item) => item !== id)].slice(0, 2);
  } else {
    // 移走一张时另一张继续保留，由对比栏提示重新补选
    state.compare = state.compare.filter((item) => item !== id);
  }
  save();
  render();
});

[mineralFilter, polarFilter].forEach((field) => field.addEventListener("input", render));

document.querySelector("#exportBtn").addEventListener("click", () => {
  const payload = {
    format: libraryFormat,
    version: 2,
    exportedAt: new Date().toISOString(),
    count: state.samples.length,
    samples: state.samples
  };
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `thin-section-library-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("#importBtn").addEventListener("click", () => {
  importInput.click();
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  importInput.value = "";
  if (!file) return;

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showNotice("导入失败：文件不是有效的 JSON，请选择样本库导出的 .json 文件。", "error");
    return;
  }

  // 新版整包 {samples:[...]}，旧版观察清单或样本数组直接为 [...]
  const records = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.samples)
      ? parsed.samples
      : null;

  if (!records) {
    showNotice("导入失败：文件中没有找到样本记录，请核对后重新选择。", "error");
    return;
  }
  if (!records.length) {
    showNotice("导入失败：文件中没有可导入的样本。", "error");
    return;
  }

  // 按样本编号判重：库中已有或文件内重复都跳过
  const knownCodes = new Set(state.samples.map((sample) => sample.code.toUpperCase()));
  let added = 0;
  let duplicated = 0;
  let invalid = 0;

  for (const raw of records) {
    const sample = normalizeSample(raw, true);
    if (!sample) {
      invalid += 1;
      continue;
    }
    const codeKey = sample.code.toUpperCase();
    if (knownCodes.has(codeKey)) {
      duplicated += 1;
      continue;
    }
    knownCodes.add(codeKey);
    state.samples.push(sample);
    added += 1;
  }

  save();
  render();

  const parts = [`导入完成：新增 ${added} 张`];
  if (duplicated) parts.push(`重复编号跳过 ${duplicated} 张`);
  if (invalid) parts.push(`无编号记录跳过 ${invalid} 张`);
  showNotice(parts.join("，") + "。", added ? "success" : "error");
});

render();
