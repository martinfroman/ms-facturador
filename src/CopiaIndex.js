import 'dotenv/config';
import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(
    `Facturación ARCA corriendo en puerto ${config.port} [${config.env}]`,
  );
});
