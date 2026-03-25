import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SearchPage from './SearchPage';

const CaenPage = () => {
  const { code } = useParams();

  return (
    <>
      <Helmet>
        <title>Firme CAEN {code} - Companii, date publice | mFirme</title>
        <meta 
          name="description" 
          content={`Vezi firmele încadrate la codul CAEN ${code}. Caută companii după județ, localitate, cifră de afaceri, profit și alte criterii.`}
        />
      </Helmet>

      <div className="bg-secondary/30 border-b border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2" data-testid="caen-title">
            Firme CAEN {code}
          </h1>
          <p className="text-sm text-muted-foreground">
            Companii cu codul CAEN {code}
          </p>
        </div>
      </div>

      <SearchPage initialFilters={{ caen: code }} />
    </>
  );
};

export default CaenPage;