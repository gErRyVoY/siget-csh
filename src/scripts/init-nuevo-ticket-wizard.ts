import { initTicketWizard } from '../lib/ticket-wizard';

function initialize() {
    const dataElement = document.getElementById('categories-data');
    if (dataElement && dataElement.textContent) {
        try {
            const categoriesData = JSON.parse(dataElement.textContent);
            initTicketWizard(categoriesData);
        } catch (e) {
            console.error('Failed to parse categories data:', e);
        }
    } else {
        console.error('Could not find categories data element.');
    }
}

document.addEventListener('astro:page-load', initialize);
