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
6. **Kabul testi** — `RO_Analyses_sade.xlsx` (ya da yeni PI çekimi) yüklenip son 7 gün (26.03–01.04.2026) Excel sonuçlarıyla ±%1 karşılaştırılacak. Örnek hedefler: P1-A Qp 72,65 · recovery 77,46 · St1 dP 2,53 · norm St1 dP 3,13 bar (%156) · NPF 84,0 · NSP %108; P1-C NPF 58,7 · norm St1 dP %222; P2-A recovery 85,1 · NPF 91,3 · OK.
7. **Rapor çıktısı** — haftalık karar tablosunun Excel indirmesi (`downloads` yeteneği sayfada tanımlı).
