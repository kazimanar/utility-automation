# Veri çekme otomasyonu — seçenekler

## Bugünkü durum

- Kaynak: `%OneDriveCommercial%\PTA\13.Data for Analyses\Demin Water\RO_Analyses_rev2.xlsx` (~20 MB), iş bilgisayarında, PI DataLink eklentisi kurulu Excel'de.
- "Pass1-2 Data" sayfasında her kolon bir `PIAdvCalcDat` dizi formülü: B1 `t-90d` → C1 `*`, 10 dk zaman ağırlıklı ortalama, aralık `…7:…13059` (bkz. `veri-sozlesmesi.md`).
- Dosya açılınca formüller kendiliğinden yeniden çalışmıyor. Tarih ifadeleri doğru olsa da veriyi tazelemek için PI DataLink penceresinden fonksiyonu açıp OK'e basmak gerekiyor.
- İkinci sorun: `t` bugünün 00:00'ı olduğundan satır sayısı gün içinde artar. Günün geç saatlerinde 13.053 satırlık aralığı aşar ("Resize to show all values").
- Panel bu dosyayı olduğu gibi okuyabiliyor: 07.10.2026 kabul testinde Excel Panel sayfasıyla birebir aynı sonuç verdi.

## Adım 1 — dizi aralığını bir kez büyütün (elle, tek seferlik)

PI DataLink'te her fonksiyonun aralığını ~93 güne çıkarın (ör. `7:13406`). Yapmanın yolu: fonksiyon hücresini seçip PI DataLink penceresini açın, çıktı aralığını büyütüp OK'e basın. Bundan sonra "Resize" sorunu kalmaz; artan satırlar boş görünür ve panel onları zaten atlıyor. Aralık yeterli olunca tazeleme, Excel'in tam yeniden hesaplamasına indirgenir (`Ctrl+Alt+F9`, VBA'da `Application.CalculateFull`). PI DataLink formüllerinin tam yeniden hesaplamada güncellendiği sizin PC'nizde doğrulanmalı: Ctrl+Alt+F9'a basıp son zaman damgasının ilerlediğine bakın.

## Adım 2 — tek tuşla "güncelle + panele uygun dosya çıkar" (VBA)

Ana dosya `.xlsx` olarak kalsın. Makroyu ayrı küçük bir `PI_Guncelle.xlsm` dosyasına koyun. Makro ana dosyayı açar, PI verisini tazeler, kaydeder ve yalnız "Pass1-2 Data" sayfasının **değerlerini** küçük bir dışa aktarım dosyasına yazar. Panele bu dosya yüklenir: 20 MB yerine birkaç MB olur ve daha hızlı okunur.

```vba
' PI_Guncelle.xlsm › Module1  (taslak: iş PC'sinde denenmeli)
Option Explicit
Const KLASOR As String = "\PTA\13.Data for Analyses\Demin Water\"
Const KAYNAK As String = "RO_Analyses_rev2.xlsx"
Const SAYFA As String = "Pass1-2 Data"

Sub PI_Guncelle_ve_Disari_Aktar()
    Dim kok As String, wb As Workbook, ws As Worksheet, wbOut As Workbook
    Dim nSat As Long, nKol As Long, hedefKlasor As String, hedef As String
    kok = Environ("OneDriveCommercial") & KLASOR       ' ThisWorkbook.Path OneDrive'da URL döndürebilir
    Set wb = Workbooks.Open(kok & KAYNAK, UpdateLinks:=False)
    Set ws = wb.Worksheets(SAYFA)
    Application.ScreenUpdating = False
    Application.CalculateFull                        ' PI DataLink fonksiyonlarını yeniden çalıştırır
    DoEvents
    nSat = ws.UsedRange.Rows.Count
    nKol = ws.UsedRange.Columns.Count
    Set wbOut = Workbooks.Add(xlWBATWorksheet)
    wbOut.Worksheets(1).Name = SAYFA
    wbOut.Worksheets(1).Range("A1").Resize(nSat, nKol).Value = ws.Range("A1").Resize(nSat, nKol).Value
    hedefKlasor = kok & "PI_export\"
    If Dir(hedefKlasor, vbDirectory) = "" Then MkDir hedefKlasor
    hedef = hedefKlasor & "PI_Pass12_" & Format(Now, "yyyy-mm-dd_hhnn") & ".xlsx"
    Application.DisplayAlerts = False
    wbOut.SaveAs hedef, xlOpenXMLWorkbook
    wbOut.Close False
    wb.Save
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    MsgBox "PI verisi güncellendi:" & vbCrLf & hedef, vbInformation
End Sub
```

Panele yükleme: **PI Excel yükle** → `PI_export\PI_Pass12_…xlsx`. Önceden yüklenmiş ve değişmemiş günler atlanır; yalnız yeni ve değişen günler yazılır.

## Adım 3 — zamanlanmış çalıştırma (isteğe bağlı)

Windows Görev Zamanlayıcı ile her sabah (ör. 06:30) `PI_Guncelle.xlsm`'deki makro çalıştırılabilir (bir `.vbs` başlatıcısı Excel'i açar ve `Application.Run` ile makroyu çağırır). Dikkat edilecekler:

- Otomasyonla açılan Excel'de COM eklentileri her zaman yüklenmez. Makronun başında PI DataLink eklentisinin `Connect = True` yapılması gerekebilir (`Application.COMAddIns` içinde açıklaması "PI DataLink" olan eklenti).
- Görev, kullanıcı oturumu açıkken ve PI sunucusuna erişim varken çalışmalı. Şirket BT politikası zamanlanmış Excel otomasyonuna izin vermeyebilir.

## Adım 4 — panele otomatik aktarım (karar bekliyor)

Panel bir claude.ai artifact'ı ve paylaşılan veri deposunu sayfa ya da Claude yazabiliyor. OneDrive'daki dosyayı buluttan doğrudan okuyan bir bağlantı bu ortamda yok. Seçenekler:

| Seçenek | Ne gerekir | Not |
|---|---|---|
| A. Elle yükleme (önerilen başlangıç) | Adım 2 | Günde bir dosya seçme işlemi |
| B. Claude masaüstü uygulaması | Dışa aktarım klasörüne erişen bir Claude oturumu | Dosyayı okuyup panelin deposuna yazabilir; iş PC'sinde denenmeli |
| C. Excel'siz doğrudan çekim | Canary Views / PI Web API erişimi ve kullanıcı/anahtar (BT) | Tag'ler Canary'de (`GLXtoCANARY`). Ağ içindeki bir betik 10 dk ortalamaları çekip dışa aktarım dosyasını üretir; PI DataLink ve Excel'e bağımlılık kalkar |
