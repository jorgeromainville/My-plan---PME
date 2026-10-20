import React from 'react';
import { LegalPage } from '../src/components/LegalPage';
import { LEGAL_UPDATED, privacySections } from '../src/data/legal';

export default function Privacidad() {
  return (
    <LegalPage
      title="Política de privacidad"
      updated={LEGAL_UPDATED}
      sections={privacySections}
    />
  );
}
