# Yol haritası

Bu faz: panel yalnız ham PI Excel'ini alır ve tüm KPI'ları kendisi hesaplar (bkz. `veri-sozlesmesi.md`).

## Karar bekleyen sonraki fazlar

1. **Elle giriş verileri** — panel kurulduktan sonra konuşulacak:
   - SMBS dozajı / tüketimi
   - SDI15 ölçümleri (UF çıkışı / RO girişi)
   - CIP kaydı (hat, tarih, kimyasal, öncesi/sonrası NPF ve dP) → trend grafiklerinde işaret, CIP sonrası toparlanma
   - Kartuş filtre değişimleri, membran değişimleri
   - Saklama önerisi: `kayitlar/{tur}/{id}` koleksiyonları; grafiklerde dikey olay çizgileri.
2. **ACF ve katyon/anyon tag'leri** — tag numaraları belli olunca `panel/tags.js` içindeki boş yuvalara yazılır (o zamana kadar yükleme diyaloğundaki eşleştirme kullanılır). Katyon/anyon için rejenerasyon sonrası üretim (servis hacmi) ve silika kırılma uyarısı eklenebilir.
3. **TI-73052 teyidi** — Pass-2 çıkış sıcaklığı olduğu teyit edilmeli; değilse sözlükten çıkarılır.
4. **P2 permeat EC ve nihai ürün EC limitleri** — değerler belirlenince Ayarlar'dan girilir.
5. **NSP_ref (Pass-2)** — P2 için referans tuz geçişi belirlenirse NSP %ref P2'de de hesaplanır ve durum kuralına girer.
6. **Kabul testi — geçti (07.10.2026).** `RO_Analyses_rev2.xlsx` ("Pass1-2 Data", 08.07–06.10.2026 14:00, 13.045 dilim, 82 tag'in tamamı sözlükle eşleşti) panelin `calc.js`'iyle işlendi. Son 7 gün ortalamaları Excel'in Panel sayfasıyla 8 hattın tamamında, tüm kolonlarda (çalışma saati, Qp, recovery, gerçek/normalize St1 dP, St2 %ref, NPF, NPF ve St1 dP eğimleri, NSP %ref, P2 permeat EC) ve durumda (P1-A..D CIP, P2-A/B/C OK, P2-D CIP) gösterilen hassasiyette birebir aynı. Excel Panel'deki "Son CIP", "CIP'ten beri" ve "Sıçrama" kolonları CIP_Raw/Sıçrama sayfalarından geliyor; bunlar 1. maddedeki elle giriş fazına ait.
7. **Veri çekme otomasyonu** — seçenekler `docs/otomasyon.md` içinde.
8. **Rapor çıktısı** — haftalık karar tablosunun Excel indirmesi (`downloads` yeteneği sayfada tanımlı).
