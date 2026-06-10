import { FactionRecordDatabase } from './types';

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
};

export const findRecordDatabase = (
  recordDatabases: FactionRecordDatabase[] | undefined | null,
  identifier: number | string | null | undefined
): FactionRecordDatabase | undefined => {
  if (!recordDatabases || identifier === null || identifier === undefined) return undefined;
  
  const idStr = String(identifier).trim();
  if (!idStr) return undefined;

  // 1. Try finding by direct ID match (numeric or string)
  const matchedById = recordDatabases.find(db => String(db.id) === idStr);
  if (matchedById) return matchedById;
  
  // 2. Try finding by record_shortcode (case-insensitive)
  const matchedByShortcode = recordDatabases.find(db => 
    db.record_shortcode && db.record_shortcode.toUpperCase() === idStr.toUpperCase()
  );
  if (matchedByShortcode) return matchedByShortcode;
  
  // 3. Try finding by api_database_type (e.g. 'gtaw_characters')
  const matchedByApiType = recordDatabases.find(db =>
    db.api_database_type && db.api_database_type.toUpperCase() === idStr.toUpperCase()
  );
  if (matchedByApiType) return matchedByApiType;
  
  // 4. Try legacy shortcode to API type map
  const apiTypeMap: Record<string, string> = {
    'CHARS': 'gtaw_characters',
    'ACTIVITY': 'gtaw_activity',
    'CHIST': 'gtaw_history',
    'CNAME': 'gtaw_name_changes',
  };
  const mappedApiType = apiTypeMap[idStr.toUpperCase()];
  if (mappedApiType) {
    const matchedByMappedApiType = recordDatabases.find(db =>
      db.api_database_type && db.api_database_type.toUpperCase() === mappedApiType.toUpperCase()
    );
    if (matchedByMappedApiType) return matchedByMappedApiType;
  }
  
  return undefined;
};
