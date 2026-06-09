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
          snap.forEach(d => {
            const r = d.data();
            parsedItems.push({
              date: r['date'] || r['Date'] || '',
              branch_name: r['branch_name'] || r['Branch Name'] || r['Branch'] || '',
              category: r['category'] || r['Category'] || '',
              product_code: r['product_code'] || r['Product Code'] || '',
              product_description: r['product_description'] || r['Product Description'] || '',
              uom: r['UOM'] || r['uom'] || '',
              qty: parseFloat(r['qty'] || r['Qty'] || 0),
              srs_reference: r['srs_reference'] || r['SRS Reference'] || r['SRS No.'] || ''
            });
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
