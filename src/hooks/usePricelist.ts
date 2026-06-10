import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';

export interface PriceEntry {
  product_code: string;
  product_description: string;
  case_price: number;
  subcase_price: number;
  piece_price: number;
}

export type PriceMap = Record<string, PriceEntry>;

export const usePricelist = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [priceMap, setPriceMap] = useState<PriceMap>({});

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastPricelistUpload = globalData?.lastPricelistUpload || 0;

        const cacheKey = 'pricelist_cache_v1';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('pricelist_lastUpload');

        if (cachedData && cachedUpload === lastPricelistUpload) {
          setPriceMap(cachedData);
          setLoading(false);
          return;
        }

        const snap = await getDocs(collection(db, 'reference_pricelist'));
        const map: PriceMap = {};

        const getValue = (r: any, keys: string[]) => {
          for (const k of keys) {
            if (r[k] !== undefined && r[k] !== null) return r[k];
          }
          const rowKeys = Object.keys(r);
          for (const k of keys) {
            const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === nk);
            if (match && r[match] !== undefined && r[match] !== null) return r[match];
          }
          return '';
        };

        snap.forEach(d => {
          const data = d.data();
          if (data.rows) {
            const chunk = JSON.parse(data.rows);
            chunk.forEach((r: any) => {
              const code = String(getValue(r, ['product_code', 'Product Code', 'ProductCode']) || '');
              if (code) {
                map[code] = {
                  product_code: code,
                  product_description: String(getValue(r, ['product_description', 'Product Description', 'Description']) || ''),
                  case_price: parseFloat(getValue(r, ['Case', 'case', 'CASE']) || 0),
                  subcase_price: parseFloat(getValue(r, ['Subcase', 'subcase', 'SUBCASE', 'Sub Case', 'sub_case']) || 0),
                  piece_price: parseFloat(getValue(r, ['Piece', 'piece', 'PIECE', 'PC', 'pc']) || 0)
                };
              }
            });
          }
        });

        await set(cacheKey, map);
        await set('pricelist_lastUpload', lastPricelistUpload);
        setPriceMap(map);
      } catch (err) {
        console.error('Error fetching Pricelist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  return { loading, priceMap };
};

// Utility: get price for a product based on UOM
export const getPrice = (priceMap: PriceMap, productCode: string, uom: string): number => {
  const entry = priceMap[String(productCode)];
  if (!entry) return 0;
  const normalizedUom = (uom || '').toLowerCase().trim();
  if (normalizedUom === 'case' || normalizedUom === 'cs') return entry.case_price;
  if (normalizedUom === 'subcase' || normalizedUom === 'scs' || normalizedUom === 'sub case') return entry.subcase_price;
  if (normalizedUom === 'piece' || normalizedUom === 'pc' || normalizedUom === 'pcs') return entry.piece_price;
  // Default fallback to piece
  return entry.piece_price;
};
