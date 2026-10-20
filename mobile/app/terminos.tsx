import React from 'react';
import { LegalPage } from '../src/components/LegalPage';
import { LEGAL_UPDATED, termsSections } from '../src/data/legal';

export default function Terminos() {
  return (
    <LegalPage
      title="Términos de uso"
      updated={LEGAL_UPDATED}
      sections={termsSections}
    />
  );
}
