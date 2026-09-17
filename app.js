const AUTHORIZED_EMAILS = ['ramiro@ark-ti.com', 'ramiro@wembii.com', 'ramiroanastasi@gmail.com'];
const GOOGLE_CLIENT_ID = '548069651896-78sjn6h78pdl63tg3q4porlp0rp9obho.apps.googleusercontent.com';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function handleGoogleCredential(response) {
  const { data, error } = await supabaseClient.auth.signInWithIdToken({ provider: 'google', token: response.credential });
  if (error) {
    console.error(error);
    document.querySelector('#loginStatus').textContent = 'No se pudo validar la cuenta de Google.';
    return;
  }
  const email = data.user.email.toLowerCase();
  if (!AUTHORIZED_EMAILS.includes(email)) {
    document.querySelector('#loginStatus').textContent = 'Esta cuenta no está autorizada para ingresar.';
    await supabaseClient.auth.signOut();
    return;
  }
  document.querySelector('#loginScreen').classList.add('hidden');
  document.querySelector('.app-shell').classList.add('authenticated');
  document.querySelector('#loginStatus').textContent = `Sesión iniciada como ${email}`;
  init();
}

function initializeGoogleLogin() {
  if (GOOGLE_CLIENT_ID.startsWith('YOUR_') || !window.google?.accounts?.id) {
    document.querySelector('#loginStatus').textContent = 'Falta configurar el Client ID de Google Cloud.';
    return;
  }
  window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
  window.google.accounts.id.renderButton(document.querySelector('#googleButton'), { theme: 'outline', size: 'large', width: 300, text: 'continue_with' });
}

window.setTimeout(initializeGoogleLogin, 500);
window.addEventListener('load', () => window.setTimeout(() => document.querySelector('#loadingScreen').classList.add('hidden'), 900));

document.querySelector('#devAccess').addEventListener('click', () => {
  document.querySelector('#loginScreen').classList.add('hidden');
  document.querySelector('.app-shell').classList.add('authenticated');
  document.querySelector('#loginStatus').textContent = 'Modo desarrollo activo · sin sesión real, no vas a ver ni poder guardar movimientos';
  init();
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  window.google?.accounts?.id?.disableAutoSelect();
  await supabaseClient.auth.signOut();
  movements = [];
  document.querySelector('.app-shell').classList.remove('authenticated');
  document.querySelector('#loginScreen').classList.remove('hidden');
  document.querySelector('#loginStatus').textContent = 'Sesión cerrada.';
});

let movements = [];
let companyIds = {};

const wembiiMonthly = [
  { month: '2026-01', income: 3089990, localExpenses: 3095008, foreignClp: 281008, foreignUsd: 295 },
  { month: '2026-02', income: 2117735, localExpenses: 2918303, foreignClp: 287903, foreignUsd: 302 },
  { month: '2026-03', income: 2117735, localExpenses: 4301903, foreignClp: 287903, foreignUsd: 302 },
  { month: '2026-04', income: 2817735, localExpenses: 1751903, foreignClp: 287903, foreignUsd: 302 },
  { month: '2026-05', income: 2592735, localExpenses: 1879803, foreignClp: 315803, foreignUsd: 332 },
  { month: '2026-06', income: 2892735, localExpenses: 1579803, foreignClp: 315803, foreignUsd: 332 },
  { month: '2026-07', income: 1930000, localExpenses: 2307650, foreignClp: 323150, foreignUsd: 300 },
  { month: '2026-08', income: 3170000, localExpenses: 2950067, foreignClp: 374680, foreignUsd: 355 },
  { month: '2026-09', income: 2623058, localExpenses: 2485498, foreignClp: 267908, foreignUsd: 244 }
];

const rows = document.querySelector('#movementRows');
const monthlyRows = document.querySelector('#monthlyRows');
const companyNames = ['Todas las empresas', 'Wembii', 'Ark Host', 'Ark Studio'];
const monthNames = { all: 'Global', '2026-01': 'Enero 2026', '2026-02': 'Febrero 2026', '2026-03': 'Marzo 2026', '2026-04': 'Abril 2026', '2026-05': 'Mayo 2026', '2026-06': 'Junio 2026', '2026-07': 'Julio 2026', '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026' };
const typeLabels = { income: { singular: 'Ingreso', plural: 'Ingresos' }, expense: { singular: 'Egreso', plural: 'Egresos' }, investment: { singular: 'Inversión', plural: 'Inversiones' } };
let companyIndex = 0;
let movementType = 'income';
let monthlyAscending = false;
let editingMovement = null;
let movementSort = { key: 'description', direction: 1 };
let excludedMetrics = new Set();
let distributionBasis = 'income';

function companyBadge(name) {
  return name === 'Wembii' ? 'badge-n' : name === 'Ark Host' ? 'badge-v' : 'badge-b';
}

async function loadMovements() {
  const { data: companiesData, error: companiesError } = await supabaseClient.from('companies').select('id, name');
  if (companiesError) { console.error(companiesError); showToast('Error cargando empresas'); return; }
  companyIds = Object.fromEntries(companiesData.map((company) => [company.name, company.id]));
  const { data, error } = await supabaseClient
    .from('movements')
    .select('id, month, type, description, amount, currency, status, payment_method, card, companies(name)')
    .order('id', { ascending: true });
  if (error) { console.error(error); showToast('Error cargando movimientos'); return; }
  movements = data.map((row) => ({
    id: row.id,
    description: row.description,
    company: row.companies.name,
    month: row.month,
    type: row.type,
    currency: row.currency,
    amount: Number(row.amount),
    status: row.status,
    paymentMethod: row.payment_method || '',
    card: row.card || '',
    code: row.companies.name[0],
    badge: companyBadge(row.companies.name),
    date: monthNames[row.month],
    category: typeLabels[row.type].singular
  }));
}

function formatMoney(value, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function convertedValues(movement) {
  const rate = Number(document.querySelector('#exchangeRate').value) || 950;
  return movement.currency === 'CLP' ? { clp: movement.amount, usd: movement.amount / rate } : { clp: movement.amount * rate, usd: movement.amount };
}

function wembiiMonthValues(month) {
  const hasRealData = movements.some((movement) => movement.company === 'Wembii' && movement.month === month);
  if (hasRealData) return { income: 0, expenses: 0 };
  const summary = wembiiMonthly.find((item) => item.month === month);
  if (!summary) return { income: 0, expenses: 0 };
  const rate = Number(document.querySelector('#exchangeRate').value) || 950;
  return { income: summary.income, expenses: summary.localExpenses + (summary.foreignUsd * rate) };
}

function companyMonthValues(company, month) {
  if (month === 'all') {
    return wembiiMonthly.reduce((totals, item) => {
      const values = companyMonthValues(company, item.month);
      return { income: totals.income + values.income, expenses: totals.expenses + values.expenses, investment: totals.investment + values.investment };
    }, { income: 0, expenses: 0, investment: 0 });
  }
  const historic = wembiiMonthValues(month);
  const companyMovements = movements.filter((movement) => movement.company === company && movement.month === month);
  const dbValues = {
    income: companyMovements.filter((movement) => movement.type === 'income').reduce((total, movement) => total + convertedValues(movement).clp, 0),
    expenses: companyMovements.filter((movement) => movement.type === 'expense').reduce((total, movement) => total + convertedValues(movement).clp, 0),
    investment: companyMovements.filter((movement) => movement.type === 'investment').reduce((total, movement) => total + convertedValues(movement).clp, 0)
  };
  if (company !== 'Wembii') return dbValues;
  return { income: historic.income + dbValues.income, expenses: historic.expenses + dbValues.expenses, investment: dbValues.investment };
}

function cumulativeNet(companies, uptoMonth) {
  return wembiiMonthly
    .map((item) => item.month)
    .filter((month) => uptoMonth === 'all' || month <= uptoMonth)
    .reduce((total, month) => companies.reduce((subtotal, company) => {
      const values = companyMonthValues(company, month);
      const income = excludedMetrics.has('income') ? 0 : values.income;
      const expenses = excludedMetrics.has('expenses') ? 0 : values.expenses;
      const investment = excludedMetrics.has('investment') ? 0 : values.investment;
      return subtotal + income - expenses - investment;
    }, total), 0);
}

function updateMetrics() {
  const selected = companyNames[companyIndex];
  const selectedMonth = document.querySelector('#monthSelect').value;
  const selectedCompanies = selected === 'Todas las empresas' ? companyNames.slice(1) : [selected];
  const totals = selectedCompanies.reduce((sum, company) => {
    const values = companyMonthValues(company, selectedMonth);
    return { income: sum.income + values.income, expenses: sum.expenses + values.expenses, investment: sum.investment + values.investment };
  }, { income: 0, expenses: 0, investment: 0 });
  const netIncome = excludedMetrics.has('income') ? 0 : totals.income;
  const netExpenses = excludedMetrics.has('expenses') ? 0 : totals.expenses;
  const netInvestment = excludedMetrics.has('investment') ? 0 : totals.investment;
  const liquidity = cumulativeNet(selectedCompanies, selectedMonth);
  document.querySelector('#liquidity').textContent = formatMoney(liquidity);
  document.querySelector('#income').textContent = formatMoney(totals.income);
  document.querySelector('#expenses').textContent = formatMoney(totals.expenses);
  document.querySelector('#investment').textContent = formatMoney(totals.investment);
  document.querySelector('#netResult').textContent = formatMoney(netIncome - netExpenses - netInvestment);
}

function renderRows() {
  const selected = companyNames[companyIndex];
  const selectedMonth = document.querySelector('#monthSelect').value;
  const periodVisible = movements.filter((movement) => (selected === 'Todas las empresas' || movement.company === selected) && (selectedMonth === 'all' || movement.month === selectedMonth));
  updateMetrics();
  const statusFilter = document.querySelector('#statusFilter').value;
  const categoryFilter = document.querySelector('#categoryFilter').value.trim().toLowerCase();
  const filteredDetails = periodVisible.filter((movement) => movement.type === movementType && (statusFilter === 'all' || movement.status === statusFilter) && (!categoryFilter || movement.category.toLowerCase().includes(categoryFilter)));
  filteredDetails.sort((left, right) => {
    const leftValue = movementSort.key === 'amount' ? convertedValues(left).clp : String(left[movementSort.key] || '').toLowerCase();
    const rightValue = movementSort.key === 'amount' ? convertedValues(right).clp : String(right[movementSort.key] || '').toLowerCase();
    return (leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0) * movementSort.direction;
  });
  document.querySelector('#movementSubtitle').textContent = `${typeLabels[movementType].plural} en detalle · ${monthNames[selectedMonth]}`;
  const isGlobal = selected === 'Todas las empresas';
  document.querySelector('#companyHeader').style.display = isGlobal ? '' : 'none';
  document.querySelector('#dateHeader').style.display = isGlobal ? '' : 'none';
  rows.innerHTML = filteredDetails.map((movement) => {
    const values = convertedValues(movement);
    const sign = movement.type !== 'income' ? '-' : '+';
    const amountClass = movement.type !== 'income' ? 'expense-amount' : 'income-amount';
    const payment = movement.type !== 'income' ? `${movement.paymentMethod || 'No especificada'}${movement.card ? ` · ${movement.card}` : ''}` : '—';
    return `<tr class="editable-row" data-id="${movement.id}"><td>${movement.description}</td>${isGlobal ? `<td><span class="company-cell"><i class="company-badge ${movement.badge}">${movement.code}</i>${movement.company}</span></td><td>${movement.date}</td>` : ''}<td>${movement.category}</td><td><button type="button" class="status status-toggle ${movement.status === 'Pagado' ? 'status-paid' : 'status-pending'}" data-id="${movement.id}">${movement.status}</button></td><td>${payment}</td><td class="${amountClass}">${sign}${formatMoney(values.clp, 'CLP')}<small class="converted">${sign}${formatMoney(values.usd, 'USD')}</small></td></tr>`;
  }).join('') || `<tr><td colspan="${isGlobal ? 7 : 5}" class="empty-state">No hay movimientos para este mes y empresa.</td></tr>`;
}

function openMovementModal(movement = null) {
  editingMovement = movement;
  document.querySelector('#modalTitle').textContent = movement ? 'Editar movimiento' : 'Añadir movimiento';
  document.querySelector('#movementDescription').value = movement?.description || '';
  document.querySelector('#movementCompany').value = movement?.company || companyNames[Math.max(companyIndex, 1)];
  document.querySelector('#movementMonth').value = movement?.month || document.querySelector('#monthSelect').value;
  document.querySelector('#movementKind').value = movement?.type || movementType;
  document.querySelector('#movementCurrency').value = movement?.currency || 'CLP';
  document.querySelector('#movementAmount').value = movement?.amount || '';
  document.querySelector('#movementStatus').value = movement?.status === 'Pendiente' ? 'Pendiente' : 'Pagado';
  document.querySelector('#movementPayment').value = movement?.paymentMethod || '';
  document.querySelector('#movementCard').value = movement?.card || '';
  document.querySelector('#cardField').style.display = movement?.paymentMethod === 'Tarjeta' ? '' : 'none';
  document.querySelector('#deleteMovement').style.display = movement ? 'inline-block' : 'none';
  document.querySelector('#movementModal').classList.add('open');
  document.querySelector('#movementModal').setAttribute('aria-hidden', 'false');
}

function closeMovementModal() {
  document.querySelector('#movementModal').classList.remove('open');
  document.querySelector('#movementModal').setAttribute('aria-hidden', 'true');
  editingMovement = null;
}

function renderMonthlySummary() {
  const selected = companyNames[companyIndex];
  const companies = selected === 'Todas las empresas' ? companyNames.slice(1) : [selected];
  const chronologicalMonths = wembiiMonthly.map((item) => item.month);
  monthlyRows.innerHTML = companies.flatMap((company) => {
    let carry = 0;
    const chronologicalRows = chronologicalMonths.map((month) => {
    const values = companyMonthValues(company, month);
    const income = values.income;
    const expenses = values.expenses + values.investment;
    const opening = carry;
    const net = income - expenses;
    carry += net;
    const netClass = net < 0 ? 'expense-amount' : 'income-amount';
    const carryClass = carry < 0 ? 'expense-amount' : 'income-amount';
    return `<tr><td><strong>${company}</strong></td><td>${monthNames[month]}</td><td>${formatMoney(opening)}</td><td class="income-amount">${formatMoney(income)}</td><td class="expense-amount">${formatMoney(expenses)}</td><td class="${netClass}">${formatMoney(net)}</td><td class="${carryClass}"><strong>${formatMoney(carry)}</strong></td></tr>`;
    });
    return monthlyAscending ? chronologicalRows : chronologicalRows.reverse();
  }).join('');
}

function renderDistribution() {
  const selectedMonth = document.querySelector('#monthSelect').value;
  const list = document.querySelector('.company-list');
  const donut = document.querySelector('.donut');
  const title = document.querySelector('#distributionTitle');
  const subtitle = document.querySelector('#distributionSubtitle');
  const donutTotal = document.querySelector('.donut-center strong');
  const companies = companyNames.slice(1);
  const dotClasses = ['dot-a', 'dot-b', 'dot-c'];
  const colors = ['var(--green)', '#7ea5d6', '#f3b27f'];
  const basisLabel = distributionBasis === 'income' ? 'Ingresos' : 'Gastos';
  const amounts = companies.map((company) => {
    const values = companyMonthValues(company, selectedMonth);
    return Math.max(0, distributionBasis === 'income' ? values.income : values.expenses + values.investment);
  });
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  title.textContent = `${basisLabel} por empresa`;
  subtitle.textContent = `% de ${basisLabel.toLowerCase()} · ${monthNames[selectedMonth]}`;
  donutTotal.textContent = formatMoney(total);
  if (total <= 0) {
    donut.style.background = '#e9eeec';
    list.innerHTML = companies.map((company, index) => `<div><span class="company-name"><i class="dot ${dotClasses[index]}"></i>${company}</span><strong>Sin datos</strong></div>`).join('');
    return;
  }
  let cursor = 0;
  const stops = amounts.map((amount, index) => {
    const pct = (amount / total) * 100;
    const stop = `${colors[index]} ${cursor}% ${cursor + pct}%`;
    cursor += pct;
    return stop;
  });
  donut.style.background = `conic-gradient(${stops.join(',')})`;
  list.innerHTML = companies.map((company, index) => `<div><span class="company-name"><i class="dot ${dotClasses[index]}"></i>${company}</span><strong>${Math.round((amounts[index] / total) * 100)}%</strong></div>`).join('');
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

document.querySelector('#companySwitcher').addEventListener('click', () => {
  const menu = document.querySelector('#companyMenu');
  const isOpen = menu.classList.toggle('open');
  document.querySelector('#companySwitcher').setAttribute('aria-expanded', String(isOpen));
});

const brandLogos = {
  'Wembii': { src: 'Logos/Logo Wembii Horizontal 2024.png', alt: 'Wembii' },
  'Ark Host': { src: 'Logos/Logo Ark Cuadrado (sin fondo).png', alt: 'Ark Host' },
  'Ark Studio': { src: 'Logos/Ark Studio IG.png', alt: 'Ark Studio' },
};
const defaultBrandLogo = { src: 'Logos/ARK GROUP/LOGO DEGRADE/Logo-Degrade-600px.png', alt: 'Ark Group' };

function updateBrandLogo() {
  const logo = brandLogos[companyNames[companyIndex]] || defaultBrandLogo;
  const img = document.querySelector('#sidebarBrandLogo');
  img.src = logo.src;
  img.alt = logo.alt;
}

document.querySelectorAll('#companyMenu button').forEach((option) => option.addEventListener('click', () => {
  companyIndex = Number(option.dataset.company);
  document.querySelector('#selectedCompany').textContent = companyNames[companyIndex];
  document.querySelectorAll('#companyMenu button').forEach((item) => item.classList.toggle('selected', item === option));
  document.querySelector('#companyMenu').classList.remove('open');
  document.querySelector('#companySwitcher').setAttribute('aria-expanded', 'false');
  updateBrandLogo();
  renderChart();
  renderRows();
  renderMonthlySummary();
  renderDistribution();
  showToast(`Viendo ${companyNames[companyIndex].toLowerCase()}`);
}));

document.addEventListener('click', (event) => {
  if (!event.target.closest('.workspace-switcher')) {
    document.querySelector('#companyMenu').classList.remove('open');
    document.querySelector('#companySwitcher').setAttribute('aria-expanded', 'false');
  }
});

document.querySelector('#addMovement').addEventListener('click', () => openMovementModal());
document.querySelector('#filterButton').addEventListener('click', () => document.querySelector('#movementFilters').classList.toggle('open'));
document.querySelector('#statusFilter').addEventListener('change', renderRows);
document.querySelector('#categoryFilter').addEventListener('input', renderRows);
document.querySelector('#clearFilters').addEventListener('click', () => { document.querySelector('#statusFilter').value = 'all'; document.querySelector('#categoryFilter').value = ''; renderRows(); });
document.querySelectorAll('.sort-head').forEach((head) => head.addEventListener('click', () => {
  const key = head.dataset.sort;
  movementSort = movementSort.key === key ? { key, direction: movementSort.direction * -1 } : { key, direction: 1 };
  renderRows();
}));
document.querySelector('#monthSelect').addEventListener('change', () => { renderRows(); renderDistribution(); });
document.querySelector('#monthlySort').addEventListener('click', () => {
  monthlyAscending = !monthlyAscending;
  document.querySelector('#monthlySort').textContent = monthlyAscending ? '↑ Más antiguos primero' : '↓ Más recientes primero';
  renderMonthlySummary();
});
rows.addEventListener('click', async (event) => {
  const statusButton = event.target.closest('.status-toggle');
  if (statusButton) {
    event.stopPropagation();
    const id = Number(statusButton.dataset.id);
    const nextStatus = statusButton.textContent === 'Pagado' ? 'Pendiente' : 'Pagado';
    const { error } = await supabaseClient.from('movements').update({ status: nextStatus }).eq('id', id);
    if (error) { console.error(error); showToast('Error actualizando el estado'); return; }
    const movement = movements.find((item) => item.id === id);
    if (movement) movement.status = nextStatus;
    renderRows();
    showToast(`Estado cambiado a ${nextStatus.toLowerCase()}`);
    return;
  }
  const row = event.target.closest('.editable-row');
  if (!row) return;
  const movement = movements.find((item) => item.id === Number(row.dataset.id));
  if (movement) openMovementModal(movement);
});
document.querySelector('#closeModal').addEventListener('click', closeMovementModal);
document.querySelector('#cancelModal').addEventListener('click', closeMovementModal);
document.querySelector('#deleteMovement').addEventListener('click', async () => {
  if (!editingMovement || !window.confirm('¿Eliminar este movimiento?')) return;
  const { error } = await supabaseClient.from('movements').delete().eq('id', editingMovement.id);
  if (error) { console.error(error); showToast('Error eliminando el movimiento'); return; }
  movements = movements.filter((item) => item.id !== editingMovement.id);
  closeMovementModal();
  renderChart(); renderRows(); renderMonthlySummary(); renderDistribution();
  showToast('Movimiento eliminado');
});
document.querySelector('#movementPayment').addEventListener('change', (event) => { document.querySelector('#cardField').style.display = event.target.value === 'Tarjeta' ? '' : 'none'; });
document.querySelector('#movementModal').addEventListener('click', (event) => { if (event.target.id === 'movementModal') closeMovementModal(); });
document.querySelector('#movementForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = { description: document.querySelector('#movementDescription').value.trim(), company: document.querySelector('#movementCompany').value, month: document.querySelector('#movementMonth').value, type: document.querySelector('#movementKind').value, currency: document.querySelector('#movementCurrency').value, amount: Number(document.querySelector('#movementAmount').value), status: document.querySelector('#movementStatus').value || 'Pendiente', paymentMethod: document.querySelector('#movementPayment').value, card: document.querySelector('#movementCard').value.trim() };
  const payload = { company_id: companyIds[data.company], month: data.month, type: data.type, description: data.description, amount: data.amount, currency: data.currency, status: data.status, payment_method: data.paymentMethod || null, card: data.card || null };
  if (editingMovement) {
    const { error } = await supabaseClient.from('movements').update(payload).eq('id', editingMovement.id);
    if (error) { console.error(error); showToast('Error guardando el movimiento'); return; }
    Object.assign(editingMovement, data, { code: data.company[0], badge: companyBadge(data.company), date: monthNames[data.month], category: typeLabels[data.type].singular });
  } else {
    const { data: inserted, error } = await supabaseClient.from('movements').insert(payload).select('id').single();
    if (error) { console.error(error); showToast('Error guardando el movimiento'); return; }
    movements.push({ ...data, id: inserted.id, code: data.company[0], badge: companyBadge(data.company), date: monthNames[data.month], category: typeLabels[data.type].singular });
  }
  closeMovementModal();
  renderChart(); renderRows(); renderMonthlySummary(); renderDistribution();
  showToast('Movimiento guardado');
});
document.querySelectorAll('.movement-tab').forEach((tab) => tab.addEventListener('click', () => {
  movementType = tab.dataset.type;
  document.querySelectorAll('.movement-tab').forEach((item) => item.classList.toggle('active', item === tab));
  renderRows();
}));
document.querySelector('#exchangeRate').addEventListener('input', () => { renderChart(); renderRows(); renderMonthlySummary(); renderDistribution(); });
document.querySelectorAll('.metric-toggle').forEach((card) => card.addEventListener('click', () => {
  const metric = card.dataset.metric;
  if (excludedMetrics.has(metric)) excludedMetrics.delete(metric); else excludedMetrics.add(metric);
  card.classList.toggle('excluded', excludedMetrics.has(metric));
  updateMetrics();
}));
document.querySelectorAll('.distribution-tab').forEach((tab) => tab.addEventListener('click', () => {
  distributionBasis = tab.dataset.basis;
  document.querySelectorAll('.distribution-tab').forEach((item) => item.classList.toggle('active', item === tab));
  renderDistribution();
}));

const chartData = [[72, 38], [64, 31], [79, 40], [56, 34], [88, 46], [68, 39], [76, 42]];
function renderChart() {
  const selected = companyNames[companyIndex];
  const companies = selected === 'Todas las empresas' ? companyNames.slice(1) : [selected];
  const values = wembiiMonthly.map((item) => companies.reduce((totals, company) => {
    const value = companyMonthValues(company, item.month);
    return [totals[0] + value.income, totals[1] + value.expenses + value.investment];
  }, [0, 0]));
  const maximum = Math.max(...values.flat());
  document.querySelector('#bars').innerHTML = values.map(([income, expense], index) => {
    const month = monthNames[wembiiMonthly[index].month];
    return `<div class="bar-group"><i class="bar income" style="height:${(income / maximum) * 100}%" data-month="${month}" data-label="Ingresos" data-value="${formatMoney(income)}"></i><i class="bar expense" style="height:${(expense / maximum) * 100}%" data-month="${month}" data-label="Gastos" data-value="${formatMoney(expense)}"></i></div>`;
  }).join('');
  document.querySelector('.x-axis').innerHTML = wembiiMonthly.map((item) => `<span>${monthNames[item.month].slice(0, 3)}</span>`).join('');
}

const chartTooltip = document.querySelector('#chartTooltip');
document.querySelector('.chart').addEventListener('mousemove', (event) => {
  const bar = event.target.closest('.bar');
  if (!bar) { chartTooltip.classList.remove('show'); return; }
  const chartRect = document.querySelector('.chart').getBoundingClientRect();
  chartTooltip.innerHTML = `<strong>${bar.dataset.month}</strong><span>${bar.dataset.label}: ${bar.dataset.value}</span>`;
  chartTooltip.style.left = `${event.clientX - chartRect.left}px`;
  chartTooltip.style.top = `${event.clientY - chartRect.top}px`;
  chartTooltip.classList.add('show');
});
document.querySelector('.chart').addEventListener('mouseleave', () => chartTooltip.classList.remove('show'));

async function init() {
  await loadMovements();
  renderChart();
  renderRows();
  renderMonthlySummary();
  renderDistribution();
}

async function restoreSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email || !AUTHORIZED_EMAILS.includes(email)) return;
  document.querySelector('#loginScreen').classList.add('hidden');
  document.querySelector('.app-shell').classList.add('authenticated');
  document.querySelector('#loginStatus').textContent = `Sesión iniciada como ${email}`;
  init();
}

restoreSession();