import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SearchPage from './SearchPage';

const JudetPage = () => {
  const { slug } = useParams();
  const judetName = decodeURIComponent(slug);

  return (
    <>
      <Helmet>
        <title>Firme din {judetName} - Listă companii și date publice | mFirme</title>
        <meta 
          name="description" 
          content={`Caută firme din județul ${judetName}. Vezi companii după localitate, domeniu, cifră de afaceri, profit, angajați și alte informații utile.`}
        />
      </Helmet>

      <div className="bg-secondary/30 border-b border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2" data-testid="judet-title">
            Firme din județul {judetName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Explorează toate companiile înregistrate în județul {judetName}
          </p>
        </div>
      </div>

      <SearchPage initialFilters={{ judet: judetName }} />
    </>
  );
};

export default JudetPage;