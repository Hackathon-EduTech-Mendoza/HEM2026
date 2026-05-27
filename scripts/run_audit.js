import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import fs from 'fs';

const PORT = 4321;
const ROLES = [
  { name: 'test', email: 'test@gmail.com', pass: '12345678' },
  { name: 'mentor', email: 'mentor@gmail.com', pass: '12345678' },
  { name: 'juez', email: 'juez@gmail.com', pass: '12345678' }
];

async function runAudit() {
  const browser = await puppeteer.launch({
    headless: 'new'
  });
  const port = new URL(browser.wsEndpoint()).port;

  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: parseInt(port),
    disableStorageReset: true // Crucial to keep login session
  };

  const results = {};

  for (const role of ROLES) {
    console.log(`Auditing for role: ${role.name} (${role.email})`);
    
    // Login
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/login`);
    
    // Wait for the inputs
    await page.waitForSelector('#email');
    await page.waitForSelector('#password');
    await page.waitForSelector('button[type="submit"]');

    // Fill login form
    await page.type('#email', role.email);
    await page.type('#password', role.pass);
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
    } catch(e) {
      // Check if there is an error
      const errorDiv = await page.$('#form-error');
      if (errorDiv) {
        const errorText = await page.evaluate(el => el.textContent, errorDiv);
        if (errorText) {
           console.error(`Login error for ${role.email}: ${errorText}`);
           await page.close();
           continue; // Skip this role
        }
      }
    }
    
    // Check if we are on dashboard
    const url = page.url();
    if (!url.includes('/dashboard')) {
       console.error(`Failed to login as ${role.name}. Current URL: ${url}`);
       await page.close();
       continue;
    }

    // Run Lighthouse on dashboard
    console.log(`Running Lighthouse for ${role.name} on ${url}...`);
    try {
      const runnerResult = await lighthouse(url, options);
      
      results[role.name] = {
        email: role.email,
        performance: Math.round(runnerResult.lhr.categories.performance.score * 100),
        accessibility: Math.round(runnerResult.lhr.categories.accessibility.score * 100),
        bestPractices: Math.round(runnerResult.lhr.categories['best-practices'].score * 100),
        seo: Math.round(runnerResult.lhr.categories.seo.score * 100),
      };
      
      console.log(`Scores for ${role.name}:`, results[role.name]);
    } catch(err) {
      console.error(`Lighthouse failed for ${role.name}: ${err.message}`);
    }
    
    // Logout or clear cookies for next role
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.close();
  }

  await browser.close();
  
  if (Object.keys(results).length === 0) {
     console.error('No roles could be audited successfully.');
     process.exit(1);
  }

  // Format report
  let report = '# Lighthouse Audit Report (Roles)\n\n';
  report += 'Este reporte contiene los resultados de la auditoría de Lighthouse en las páginas con sesión iniciada para cada rol.\n\n';
  for (const key of Object.keys(results)) {
    const data = results[key];
    report += `## Rol: ${key.toUpperCase()} (${data.email})\n`;
    report += `- **Performance**: ${data.performance}\n`;
    report += `- **Accessibility**: ${data.accessibility}\n`;
    report += `- **Best Practices**: ${data.bestPractices}\n`;
    report += `- **SEO**: ${data.seo}\n\n`;
  }
  
  fs.writeFileSync('C:/Users/matia/.gemini/antigravity/brain/950f3139-eacc-4658-b20f-fe6296e4a6d3/lighthouse_audit_report.md', report);
  console.log('Report generated successfully.');
}

runAudit().catch(console.error);
