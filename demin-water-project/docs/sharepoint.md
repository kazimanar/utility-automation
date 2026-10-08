# SharePoint / OneDrive sürümü

Panelin claude.ai'ye bağlı olmayan, şirket içinde çalışan sürümü: **tek bir HTML dosyası** (`sharepoint/dist/demin-panel-sharepoint.html`, ~1,2 MB). Grafik ve Excel kütüphaneleri dosyanın içindedir; internet ya da CDN gerekmez. Hesaplar claude.ai sürümüyle aynı `calc.js` / `tags.js` kodudur.

## Neden "SharePoint sayfası" değil de dosya?

SharePoint Online, kütüphaneye konan `.html` dosyalarını tarayıcıda çalıştırmaz, indirtir; modern sayfalarda özel betik de varsayılan olarak kapalıdır. Bu yüzden panel, SharePoint klasöründe duran ve OneDrive senkronuyla her kullanıcının bilgisayarına gelen bir dosya olarak açılır. Veri de aynı klasördeki bir JSON dosyasında tutulur; SharePoint bu dosyayı ekibe dağıtır.

```
SharePoint › … › Demin Water/
  demin-panel-sharepoint.html   ← panel (Edge ile açılır)
  demin-veri.json               ← paylaşılan günlük özetler, ayarlar, tag eşleştirmeleri
  RO_Analyses_rev2.xlsx         ← PI DataLink Excel'i (değişmedi)
```

## Kurulum (bir kez)

1. `demin-panel-sharepoint.html` dosyasını SharePoint'teki **Demin Water** klasörüne koyun.
2. Klasörü OneDrive ile bilgisayarınıza senkronlayın ("Eşitle" ya da "OneDrive'a kısayol ekle").
3. Dosya Gezgini'nde senkron klasördeki HTML dosyasına sağ tıklayın → **Birlikte aç › Microsoft Edge** (Chrome da olur).
4. Paneldeki sarı şeritte **Veri klasörünü seç**'e basın ve aynı Demin Water klasörünü seçin; Edge "düzenlemeye izin ver" diye sorar → izin verin. İlk açılışta `demin-veri.json` oluşturulur.
5. **PI Excel yükle** ile Excel'i yükleyip kaydedin. Klasör seçimi tarayıcıda hatırlanır; sonraki açılışlarda Edge yalnız izni bir kez onaylatabilir.

## Günlük kullanım

claude.ai sürümüyle aynı: Excel'i tazele → panelde **PI Excel yükle** → önizleme → **Kaydet**. Kayıt sonunda dosyaya tek seferde yazılır; şeritte "son kayıt" saati görünür. Panel, OneDrive senkronuyla gelen değişiklikleri dakikada bir kontrol eder; **Yeniden oku** hemen okur.

## Ekip kullanımı ve yetkiler

- **Okuma:** klasöre erişimi olan herkes HTML'i açıp klasörü bağlayabilir. Klasöre yazma yetkisi yoksa ya da tarayıcı klasör erişimini desteklemiyorsa **Veri dosyasını aç (salt okunur)** ile `demin-veri.json` seçilip görüntülenir.
- **Yazma:** SharePoint klasörüne düzenleme yetkisi olan kişiler. Yetki SharePoint'te yönetilir; panelin kendi rol sistemi yoktur.
- **Aynı anda yazma:** panel yazmadan hemen önce dosyayı yeniden okur ve kendi değişikliklerini üstüne ekler. İki kişi aynı dakikada kaydederse OneDrive bir "çakışma kopyası" oluşturabilir. Pratik kural: günlük yüklemeyi tek kişi (ya da vardiya sırasıyla) yapsın.

## Sınırlar

- Klasöre yazma, tarayıcının File System Access özelliğini kullanır: **Edge ve Chrome** destekler, Firefox ve Safari desteklemez (salt okunur açılır).
- SharePoint web arayüzünde dosyaya tıklamak paneli açmaz, indirir. Paneli senkron klasörden açın.
- Veri dosyası 1 yılda ~1,7 MB olur; sorun değildir.

## Derleme (geliştirici)

```sh
node demin-water-project/sharepoint/build.mjs
```

`panel/index.html` + `tags.js` + `calc.js` + `panel/file-store.js` ve Chart.js 4.4.1 / SheetJS 0.18.5 tek dosyada birleştirilir. Kütüphaneler ilk derlemede `sharepoint/.vendor/` klasörüne indirilir (cdnjs, olmazsa npm paketi). `file-store.js`, panelin kullandığı veri arayüzünü (`doc` / `collection`, `set`, `onSnapshot`, `where` / `orderBy` / `limit`) klasördeki JSON dosyası üzerinde sağlar; panel kodu iki sürümde de aynıdır.

## İleride: tam SharePoint entegrasyonu

BT bir SharePoint Framework (SPFx) web bölümü yayımlamaya izin verirse panel bir SharePoint sayfasına gömülebilir ve veri bir SharePoint listesinde tutulabilir (kullanıcı yetkileri SharePoint'ten gelir, dosya senkronu gerekmez). Bu, uygulama kataloğuna yönetici erişimi gerektirir.
