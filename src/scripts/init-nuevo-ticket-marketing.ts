import { initMarketingTicketWizard } from '../lib/marketing-ticket-wizard';

function initialize() {
    const dataElement = document.getElementById('marketing-data');
    if (dataElement && dataElement.textContent) {
        try {
            const marketingCategory = JSON.parse(dataElement.textContent);
            if (marketingCategory) {
                initMarketingTicketWizard(marketingCategory);
            } else {
                console.error("Marketing category not found in data.");
            }
        } catch (e) {
            console.error('Failed to parse marketing data:', e);
        }
    } else {
        console.error('Could not find marketing data element.');
    }
}

document.addEventListener('astro:page-load', initialize);
