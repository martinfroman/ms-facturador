const ENV = process.env.AFIP_ENV || 'homologacion';

const URLS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

export const config = {
  env: ENV,
  wsaaUrl: URLS[ENV].wsaa,
  wsfeUrl: URLS[ENV].wsfe,
  wsfeNs: 'http://ar.gov.afip.dif.FEV1/',
  port: process.env.PORT || 3000,
};
