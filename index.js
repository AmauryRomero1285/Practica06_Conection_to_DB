import app from './app.js';
import './db.js';
app.listen(app.get('port'), () => {
    console.log(`Servidor ejecutándose en http://localhost:${app.get('port')}`);
  });