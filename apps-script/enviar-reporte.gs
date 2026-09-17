/**
 * Envío automático de reportes financieros — Companies App
 *
 * Cómo usarlo (una vez que la base esté en Supabase cloud, no local):
 * 1. Andá a script.google.com > Nuevo proyecto, pegá este archivo.
 * 2. Project Settings > Script Properties, agregá:
 *      SUPABASE_URL          -> https://<tu-proyecto>.supabase.co
 *      SUPABASE_SERVICE_KEY  -> la "service_role key" del proyecto (Settings > API)
 *    La service_role key salta las políticas RLS, por eso NO va en el frontend
 *    y sí puede vivir acá, dentro de un script privado tuyo.
 * 3. Corré una vez la función `setupHourlyTrigger` desde el editor (▶) para
 *    instalar el disparador. Apps Script se va a fijar cada hora si hay algún
 *    envío programado (report_configs) que corresponda a esa hora.
 * 4. Listo — no hace falta cron externo, Apps Script ya lo resuelve.
 */

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('runScheduledReports').timeBased().everyHours(1).create();
}

function runScheduledReports() {
  const now = new Date();
  const configs = fetchReportConfigs();
  configs
    .filter((config) => isDue(config, now))
    .forEach((config) => sendReportEmail(config));
}

function isDue(config, now) {
  if (now.getHours() !== config.hour) return false;
  if (config.frequency === 'daily') return true;
  if (config.frequency === 'weekly') return now.getDay() === config.day_of_week;
  if (config.frequency === 'monthly') return now.getDate() === config.day_of_month;
  return false;
}

function fetchReportConfigs() {
  return supabaseSelect('report_configs', 'select=*');
}

function sendReportEmail(config) {
  const companies = config.company === 'Todas las empresas' ? ['Wembii', 'Ark Host', 'Ark Studio'] : [config.company];
  const month = currentMonthKey();
  const movements = fetchMovements(companies, month);
  const html = buildEmailHtml(config, companies, month, movements);
  MailApp.sendEmail({ to: config.email, subject: `Reporte financiero — ${config.company} · ${month}`, htmlBody: html });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fetchMovements(companies, month) {
  const companyFilter = companies.map((name) => `"${name}"`).join(',');
  const query = `select=*,companies(name)&companies.name=in.(${companyFilter})&month=eq.${month}`;
  return supabaseSelect('movements', query);
}

function buildEmailHtml(config, companies, month, movements) {
  const totals = movements.reduce((sum, movement) => {
    const amount = Number(movement.amount) * (movement.currency === 'USD' ? 950 : 1);
    if (movement.type === 'income') sum.income += amount;
    if (movement.type === 'expense') sum.expenses += amount;
    if (movement.type === 'investment') sum.investment += amount;
    return sum;
  }, { income: 0, expenses: 0, investment: 0 });
  const net = totals.income - totals.expenses - totals.investment;

  const sections = [];
  if (config.include_summary) {
    sections.push(`
      <h3>Resumen financiero — ${config.company} · ${month}</h3>
      <p>Ingresos: $${formatNumber(totals.income)}<br>
         Gastos: $${formatNumber(totals.expenses)}<br>
         Inversión: $${formatNumber(totals.investment)}<br>
         <strong>Resultado neto: $${formatNumber(net)}</strong></p>
    `);
  }
  if (config.include_movements) {
    const rows = movements
      .map((movement) => `<tr><td>${movement.description}</td><td>${movement.companies.name}</td><td>${movement.type}</td><td>$${formatNumber(movement.amount)}</td></tr>`)
      .join('');
    sections.push(`
      <h3>Detalle de movimientos</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:12px">
        <tr><th>Descripción</th><th>Empresa</th><th>Tipo</th><th>Importe</th></tr>
        ${rows || '<tr><td colspan="4">Sin movimientos este mes.</td></tr>'}
      </table>
    `);
  }
  // include_trend, include_top_expenses, include_distribution, include_monthly quedan
  // como próximos pasos: son fáciles de sumar acá con el mismo patrón, recalculando
  // sobre `movements` (o pidiendo más meses a Supabase para la tendencia histórica).
  return sections.join('<hr>');
}

function formatNumber(value) {
  return Math.round(Number(value)).toLocaleString('es-CL');
}

function supabaseSelect(table, query) {
  const url = `${PropertiesService.getScriptProperties().getProperty('SUPABASE_URL')}/rest/v1/${table}?${query}`;
  const response = UrlFetchApp.fetch(url, {
    headers: {
      apikey: PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY'),
      Authorization: `Bearer ${PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY')}`
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) {
    throw new Error(`Supabase ${table} error: ${response.getContentText()}`);
  }
  return JSON.parse(response.getContentText());
}
