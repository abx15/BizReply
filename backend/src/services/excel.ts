import * as XLSX from 'xlsx';
import { Types } from 'mongoose';

export interface ParsedItem {
  businessId: Types.ObjectId;
  type: 'service' | 'product' | 'faq' | 'policy';
  name: string;
  price?: number;
  duration?: string;
  notes?: string;
  rawRow: Record<string, any>;
}

export function parseExcelFile(buffer: Buffer, businessId: string): ParsedItem[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  const parsedItems: ParsedItem[] = [];

  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length === 0) continue;

    let nameVal = '';
    let priceVal: number | undefined = undefined;
    let durationVal = '';
    let notesVal = '';
    let itemType: 'service' | 'product' | 'faq' | 'policy' = 'service';

    // Normalize keys to lowercase for detection
    const keyMap = new Map<string, string>();
    keys.forEach(k => keyMap.set(k.toLowerCase().trim(), k));

    // 1. Detect Name / Question / Service
    const nameKeys = ['service', 'product', 'item', 'name', 'title', 'question', 'faq', 'sawaal'];
    const foundNameKey = nameKeys.find(nk => Array.from(keyMap.keys()).some(k => k.includes(nk)));
    if (foundNameKey) {
      const actualKey = Array.from(keyMap.keys()).find(k => k.includes(foundNameKey));
      if (actualKey) {
        nameVal = String(row[keyMap.get(actualKey)!]);
      }
    } else {
      // Fallback: use first column
      nameVal = String(row[keys[0]]);
    }

    if (!nameVal) continue; // Skip rows without name/question

    // 2. Detect Price / Cost
    const priceKeys = ['price', 'cost', 'rate', 'mrp', 'amount', 'paise', 'rupees'];
    const foundPriceKey = priceKeys.find(pk => Array.from(keyMap.keys()).some(k => k.includes(pk)));
    if (foundPriceKey) {
      const actualKey = Array.from(keyMap.keys()).find(k => k.includes(foundPriceKey));
      if (actualKey) {
        const numVal = parseFloat(row[keyMap.get(actualKey)!]);
        if (!isNaN(numVal)) priceVal = numVal;
      }
    }

    // 3. Detect Duration / Time
    const durationKeys = ['duration', 'time', 'mins', 'hours', 'waqt', 'samay'];
    const foundDurationKey = durationKeys.find(dk => Array.from(keyMap.keys()).some(k => k.includes(dk)));
    if (foundDurationKey) {
      const actualKey = Array.from(keyMap.keys()).find(k => k.includes(foundDurationKey));
      if (actualKey) {
        durationVal = String(row[keyMap.get(actualKey)!]);
      }
    }

    // 4. Detect Notes / Answer / Details / Description
    const noteKeys = ['notes', 'note', 'description', 'desc', 'details', 'detail', 'answer', 'ans', 'jawab', 'info', 'information'];
    const foundNoteKey = noteKeys.find(nk => Array.from(keyMap.keys()).some(k => k.includes(nk)));
    if (foundNoteKey) {
      const actualKey = Array.from(keyMap.keys()).find(k => k.includes(foundNoteKey));
      if (actualKey) {
        notesVal = String(row[keyMap.get(actualKey)!]);
      }
    }

    // 5. Determine Type
    const isFaq = Array.from(keyMap.keys()).some(k => k.includes('question') || k.includes('faq') || k.includes('answer') || k.includes('sawaal') || k.includes('jawab'));
    const isPolicy = Array.from(keyMap.keys()).some(k => k.includes('policy') || k.includes('rules') || k.includes('terms'));
    
    if (isFaq) {
      itemType = 'faq';
    } else if (isPolicy) {
      itemType = 'policy';
    } else if (priceVal !== undefined) {
      const isProduct = Array.from(keyMap.keys()).some(k => k.includes('product') || k.includes('item') || k.includes('goods'));
      itemType = isProduct ? 'product' : 'service';
    }

    parsedItems.push({
      businessId: new Types.ObjectId(businessId),
      type: itemType,
      name: nameVal.trim(),
      price: priceVal,
      duration: durationVal ? durationVal.trim() : undefined,
      notes: notesVal ? notesVal.trim() : undefined,
      rawRow: row
    });
  }

  return parsedItems;
}
