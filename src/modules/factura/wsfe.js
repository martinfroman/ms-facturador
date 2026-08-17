import { soapRequest } from '../../soap/client.js';
import { config } from '../../config.js';
import { authenticate } from '../auth/wsaa.js';
import { AfipError } from '../../errors/afipError.js';

const NS = config.wsfeNs;

function authBlock(token, sign, cuit) {
  return `<ar:Auth>
    <ar:Token>${token}</ar:Token>
    <ar:Sign>${sign}</ar:Sign>
    <ar:Cuit>${cuit}</ar:Cuit>
  </ar:Auth>`;
}

function formatDateAfip(date) {
  const d = date || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Obtiene el último número de comprobante autorizado para un punto de venta y tipo.
 * Lo necesitamos para calcular el siguiente número antes de solicitar el CAE.
 */
async function getUltimoComprobante(token, sign, cuit, puntoVenta, cbteTipo) {
  const body = `<ar:FECompUltimoAutorizado xmlns:ar="${NS}">
    ${authBlock(token, sign, cuit)}
    <ar:PtoVta>${puntoVenta}</ar:PtoVta>
    <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
  </ar:FECompUltimoAutorizado>`;

  const result = await soapRequest(
    config.wsfeUrl,
    `${NS}FECompUltimoAutorizado`,
    body,
  );

  const resp =
    result.FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult;

  if (resp?.Errors) {
    const err = Array.isArray(resp.Errors.Err)
      ? resp.Errors.Err[0]
      : resp.Errors.Err;
    throw new AfipError(
      `WSFE FECompUltimoAutorizado: ${err.Msg}`,
      err.Code,
      resp.Errors,
    );
  }

  return resp?.CbteNro ?? 0;
}

// ─── Tipos de comprobante y documento más comunes ────────────────────────────
//
//  cbteTipo: 1=FA, 2=NDA, 3=NCA, 6=FB, 7=NDB, 8=NCB, 11=FC, 12=NDC, 13=NCC
//  docTipo:  80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
//  concepto: 1=Productos, 2=Servicios, 3=Productos y Servicios
//  IVA ids:  3=0%, 4=10.5%, 5=21%, 6=27%
//  condicionIVAReceptor: 1=Resp.Inscripto, 4=Exento, 5=Consumidor Final, 6=Monotributo, etc.

/**
 * Obtiene las condiciones de IVA válidas para receptores.
 * Cada condición indica para qué tipos de comprobante (A, B, C, M) aplica.
 */
export async function getCondicionesIVAReceptor(cuit, certificado, clavePrivada) {
  const { token, sign } = await authenticate(cuit, certificado, clavePrivada, 'wsfe');

  const body = `<ar:FEParamGetCondicionIvaReceptor xmlns:ar="${NS}">
    ${authBlock(token, sign, cuit)}
  </ar:FEParamGetCondicionIvaReceptor>`;

  const result = await soapRequest(
    config.wsfeUrl,
    `${NS}FEParamGetCondicionIvaReceptor`,
    body,
  );

  const resp = result.FEParamGetCondicionIvaReceptorResponse?.FEParamGetCondicionIvaReceptorResult;

  if (resp?.Errors) {
    const err = Array.isArray(resp.Errors.Err)
      ? resp.Errors.Err[0]
      : resp.Errors.Err;
    throw new AfipError(
      `WSFE FEParamGetCondicionIvaReceptor: ${err.Msg}`,
      err.Code,
      resp.Errors,
    );
  }

  const tipos = resp?.ResultGet?.CondicionIvaReceptorTipo;
  if (!tipos) {
    return [];
  }

  const lista = Array.isArray(tipos) ? tipos : [tipos];
  return lista.map((t) => ({
    id: t.Id,
    descripcion: t.Desc,
    tiposComprobante: t.FchDesde ? {
      vigenciaDesde: t.FchDesde,
      vigenciaHasta: t.FchHasta || null,
    } : null,
  }));
}

/**
 * Solicita un CAE a AFIP para una factura electrónica.
 *
 * Flujo interno:
 *   1. Autenticar contra WSAA (o usar token cacheado)
 *   2. Consultar último comprobante autorizado (FECompUltimoAutorizado)
 *   3. Armar request FECAESolicitar con número siguiente
 *   4. Parsear respuesta y devolver CAE + datos del comprobante
 */
export async function facturar(params) {
  const {
    cuit,
    certificado,
    clavePrivada,
    puntoVenta = 1,
    cbteTipo = 11,
    concepto = 1,
    docTipo = 99,
    docNro = '0',
    condicionIVAReceptorId,
    importe,
    impNeto,
    impIVA = 0,
    impTrib = 0,
    impOpEx = 0,
    impTotConc = 0,
    iva,
    moneda = 'PES',
    cotizacion = 1,
  } = params;

  // 1. Autenticar contra WSAA
  const { token, sign } = await authenticate(cuit, certificado, clavePrivada, 'wsfe');

  // 2. Obtener siguiente número de comprobante
  const ultimoCbte = await getUltimoComprobante(
    token, sign, cuit, puntoVenta, cbteTipo,
  );
  const cbteNro = ultimoCbte + 1;

  const fecha = formatDateAfip(new Date());

  // Para Factura C (tipo 11) todo va como ImpNeto sin desglose de IVA
  const netoGravado = impNeto ?? importe;

  // Bloque de alícuotas IVA (necesario para Factura A / B)
  let ivaBlock = '';
  if (iva && iva.length > 0) {
    const ivaItems = iva
      .map(
        (item) => `<ar:AlicIva>
          <ar:Id>${item.id}</ar:Id>
          <ar:BaseImp>${item.baseImp.toFixed(2)}</ar:BaseImp>
          <ar:Importe>${item.importe.toFixed(2)}</ar:Importe>
        </ar:AlicIva>`,
      )
      .join('\n');
    ivaBlock = `<ar:Iva>${ivaItems}</ar:Iva>`;
  }

  // Campos obligatorios cuando concepto es Servicios (2) o Productos y Servicios (3)
  let serviciosBlock = '';
  if (concepto >= 2) {
    serviciosBlock = `
      <ar:FchServDesde>${fecha}</ar:FchServDesde>
      <ar:FchServHasta>${fecha}</ar:FchServHasta>
      <ar:FchVtoPago>${fecha}</ar:FchVtoPago>`;
  }

  // Bloque de condición IVA del receptor (opcional)
  const condicionIVABlock = condicionIVAReceptorId
    ? `<ar:CondicionIVAReceptorId>${condicionIVAReceptorId}</ar:CondicionIVAReceptorId>`
    : '';

  // 3. Armar y enviar FECAESolicitar
  const bodyXml = `<ar:FECAESolicitar xmlns:ar="${NS}">
    ${authBlock(token, sign, cuit)}
    <ar:FeCAEReq>
      <ar:FeCabReq>
        <ar:CantReg>1</ar:CantReg>
        <ar:PtoVta>${puntoVenta}</ar:PtoVta>
        <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
      </ar:FeCabReq>
      <ar:FeDetReq>
        <ar:FECAEDetRequest>
          <ar:Concepto>${concepto}</ar:Concepto>
          <ar:DocTipo>${docTipo}</ar:DocTipo>
          <ar:DocNro>${docNro}</ar:DocNro>
          ${condicionIVABlock}
          <ar:CbteDesde>${cbteNro}</ar:CbteDesde>
          <ar:CbteHasta>${cbteNro}</ar:CbteHasta>
          <ar:CbteFch>${fecha}</ar:CbteFch>
          <ar:ImpTotal>${importe.toFixed(2)}</ar:ImpTotal>
          <ar:ImpTotConc>${impTotConc.toFixed(2)}</ar:ImpTotConc>
          <ar:ImpNeto>${netoGravado.toFixed(2)}</ar:ImpNeto>
          <ar:ImpOpEx>${impOpEx.toFixed(2)}</ar:ImpOpEx>
          <ar:ImpIVA>${impIVA.toFixed(2)}</ar:ImpIVA>
          <ar:ImpTrib>${impTrib.toFixed(2)}</ar:ImpTrib>
          <ar:MonId>${moneda}</ar:MonId>
          <ar:MonCotiz>${cotizacion}</ar:MonCotiz>
          ${serviciosBlock}
          ${ivaBlock}
        </ar:FECAEDetRequest>
      </ar:FeDetReq>
    </ar:FeCAEReq>
  </ar:FECAESolicitar>`;

  const result = await soapRequest(
    config.wsfeUrl,
    `${NS}FECAESolicitar`,
    bodyXml,
  );

  // 4. Parsear respuesta
  const resp = result.FECAESolicitarResponse?.FECAESolicitarResult;

  if (resp?.Errors) {
    const errors = Array.isArray(resp.Errors.Err)
      ? resp.Errors.Err
      : [resp.Errors.Err];
    const messages = errors.map((e) => `[${e.Code}] ${e.Msg}`).join('; ');
    throw new AfipError(`WSFE Error: ${messages}`, errors[0]?.Code, errors);
  }

  const det = resp?.FeDetResp?.FECAEDetResponse;
  if (!det) {
    throw new AfipError(
      'WSFE: respuesta sin detalle de comprobante',
      'WSFE_NO_DETAIL',
      resp,
    );
  }

  const detalle = Array.isArray(det) ? det[0] : det;

  if (detalle.Resultado !== 'A') {
    const obs = detalle.Observaciones?.Obs;
    const obsList = Array.isArray(obs) ? obs : obs ? [obs] : [];
    const obsMsg = obsList.map((o) => `[${o.Code}] ${o.Msg}`).join('; ');
    throw new AfipError(
      `Comprobante rechazado: ${obsMsg}`,
      'WSFE_REJECTED',
      { observaciones: obsList, detalle },
    );
  }

  return {
    cae: detalle.CAE,
    caeFchVto: detalle.CAEFchVto,
    cbteNro: detalle.CbteDesde,
    cbteFch: fecha,
    puntoVenta,
    cbteTipo,
    resultado: detalle.Resultado,
  };
}
