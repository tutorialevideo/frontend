import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SearchPage from './SearchPage';

const LocalitatePage = () => {
  const { slug } = useParams();
  const localitateName = decodeURIComponent(slug || '');

  return (
    <>
      <Helmet>
        <title>{localitateName ? `Firme din ${localitateName} - Listă companii | mFirme` : 'Firme din localitate | mFirme'}</title>
        <meta 
          name="description" 
          content={localitateName ? `Descoperă firmele din ${localitateName}. Filtrează după activitate, cifră de afaceri, profit, angajați și alte criterii.` : 'Listă firme din localitate'}
        />
      </Helmet>

      <div className="bg-secondary/30 border-b border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2" data-testid="localitate-title">
            Firme din {localitateName || 'localitate'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Explorează toate companiile din {localitateName || 'localitate'}
          </p>
        </div>
      </div>

      <SearchPage initialFilters={{ localitate: localitateName }} />
    </>
  );
};

export default LocalitatePage;