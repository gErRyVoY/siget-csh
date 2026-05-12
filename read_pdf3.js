import fs from 'fs';
import pdf from 'pdf-parse';

let dataBuffer = fs.readFileSync('Incidencias.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
});
