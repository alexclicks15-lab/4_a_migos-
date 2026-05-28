import { describe, it, expect, vi } from 'vitest'
import { personalizeMessage, processSheetRows } from './sync-engine'

describe('Spreadsheet Sync Engine', () => {
  describe('personalizeMessage', () => {
    it('should do basic replacement when useAI is false', async () => {
      const template = "Hi {{name}}, your phone is {{phone}}."
      const vars = { name: "John Doe", phone: "12345678" }
      const res = await personalizeMessage(template, vars, false)
      expect(res).toBe("Hi John Doe, your phone is 12345678.")
    })

    it('should strip excessive whitespaces inside placeholders', async () => {
      const template = "Hi {{  name   }}, anniversary: {{ anniversary }}."
      const vars = { name: "Sarah Jenkins", anniversary: "2020-05-12" }
      const res = await personalizeMessage(template, vars, false)
      expect(res).toBe("Hi Sarah Jenkins, anniversary: 2020-05-12.")
    })
  })

  describe('processSheetRows', () => {
    it('should extract records, upsert contacts, and map properties correctly', async () => {
      // Mock db client with Thenable query builder mock support
      const mockChain = {
        select: () => mockChain,
        eq: () => mockChain,
        limit: () => mockChain,
        insert: () => mockChain,
        update: () => mockChain,
        single: () => Promise.resolve({ data: { id: 'contact_abc', user_id: 'user_123' }, error: null }),
        maybeSingle: () => Promise.resolve({ data: { id: 'contact_abc', user_id: 'user_123' }, error: null }),
        then: (resolve: any) => resolve({ data: { id: 'contact_abc', user_id: 'user_123' }, error: null })
      } as any

      const mockDb: any = {
        from: vi.fn(() => mockChain)
      }

      const rows = [
        { "Full Name": "Test User", "Contact Number": "+1 555-9080", "Birth Date": "1995-10-12" }
      ]

      const mapping = {
        name: 'Full Name',
        phone: 'Contact Number',
        birthday: 'Birth Date'
      }

      const triggers = {
        birthday_enabled: true,
        birthday_template: "Happy Birthday {{name}}!",
        use_ai: false
      }

      const result = await processSheetRows(rows, 'company_123', mapping, triggers, mockDb)
      expect(result.processed).toBe(1)
      expect(mockDb.from).toHaveBeenCalledWith('contacts')
    })
  })
})
