import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';

export interface WarehouseBoItem {
  date: string;
  branch_name: string;
  category: string;
  product_code: string;
  product_description: string;
  uom: string;
  qty: number;
  srs_reference: string;
}

export interface BoHistoryPoint {
  date: string;
  totalQty: number;
}

export const useWarehouseBoData = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WarehouseBoItem[]>([]);
  const [history, setHistory] = useState<BoHistoryPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [totalQty, setTotalQty] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastWarehouseBoUpload = globalData?.lastWarehouseBoUpload || 0;
        const cobDate = globalData?.cobDate || new Date().toISOString().split('T')[0];

        const cacheKey = 'warehouse_bo_cache_v1';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('warehouse_bo_lastUpload');

        let parsedItems: WarehouseBoItem[] = [];
        if (cachedData && cachedUpload === lastWarehouseBoUpload) {
          parsedItems = cachedData;
        } else {
          const snap = await getDocs(collection(db, 'warehouse_bo_data'));

          const formatExcelDate = (val: any) => {
            if (!val) return '';
            if (typeof val === 'number') {
              const d = new Date((val - 25569) * 86400 * 1000);
              return d.toISOString().split('T')[0];
            }
            return String(val);
          };

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

          const parseRow = (r: any): WarehouseBoItem => ({
            date: formatExcelDate(getValue(r, ['date', 'Date'])),
            branch_name: String(getValue(r, ['branch_name', 'Branch Name', 'Branch']) || ''),
            category: String(getValue(r, ['category', 'Category']) || ''),
            product_code: String(getValue(r, ['product_code', 'Product Code']) || ''),
            product_description: String(getValue(r, ['product_description', 'Product Description', 'Description']) || ''),
            uom: String(getValue(r, ['UOM', 'uom']) || ''),
            qty: parseFloat(getValue(r, ['qty', 'Qty']) || 0),
            srs_reference: String(getValue(r, ['srs_reference', 'SRS Reference', 'SRS No.']) || '')
          });

          snap.forEach(d => {
            const data = d.data();
            if (data.rows) {
              // Chunked format
              const chunk = JSON.parse(data.rows);
              chunk.forEach((r: any) => parsedItems.push(parseRow(r)));
            } else {
              // Old per-row format fallback
              parsedItems.push(parseRow(data));
            }
          });
          await set(cacheKey, parsedItems);
          await set('warehouse_bo_lastUpload', lastWarehouseBoUpload);
        }

        const total = parsedItems.reduce((sum, i) => sum + i.qty, 0);
        const cats = Array.from(new Set(parsedItems.map(i => i.category).filter(Boolean))).sort();
        const brs = Array.from(new Set(parsedItems.map(i => i.branch_name).filter(Boolean))).sort();

        // Fetch history for current month
        const monthKey = cobDate.substring(0, 7);
        const histDoc = await getDoc(doc(db, 'warehouse_bo_history', monthKey));
        const historyPoints: BoHistoryPoint[] = [];
        if (histDoc.exists()) {
          const datesData = histDoc.data().dates || {};
          Object.keys(datesData).sort().forEach(dateKey => {
            historyPoints.push({ date: dateKey.replace(/_/g, '-'), totalQty: datesData[dateKey] || 0 });
          });
        }

        setItems(parsedItems);
        setHistory(historyPoints);
        setCategories(cats);
        setBranches(brs);
        setTotalQty(total);
      } catch (err) {
        console.error('Error fetching Warehouse BO data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  return { loading, items, history, categories, branches, totalQty };
};
