<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/hero-light.svg">
    <img alt="claude-referee: güzel söz değil, kanıt. Claude tüm testlerin geçtiğini söylüyor; hakemin done-gate'i (v0.2) son düzenlemeden beri geçen bir kontrol olmadığını söyleyip Claude'dan cargo nextest'i çalıştırmasını istiyor; nextest 2 başarısız test gösteriyor." src="assets/hero-light.svg" width="100%">
  </picture>
</p>

<p align="center">
  <a href="LICENSE"><img alt="Lisans: MIT" src="https://img.shields.io/badge/license-MIT-4a3aa7"></a>
  <img alt="Durum: alfa" src="https://img.shields.io/badge/status-alpha-8c959f">
  <img alt="Claude Code eklentisi" src="https://img.shields.io/badge/Claude%20Code-plugin-4a3aa7">
  <img alt="Node 20.3 ya da sonrası" src="https://img.shields.io/badge/node-%E2%89%A520.3-8c959f">
  <img alt="Çalışma zamanı bağımlılığı: 0" src="https://img.shields.io/badge/runtime%20deps-0-8c959f">
</p>

<p align="center"><a href="README.md">English</a> · <b>Türkçe</b></p>

**claude-referee**, Claude Code için resmî olmayan bir eklentidir. Claude'un küçük ve denetlenebilir soruları [TypeSafe Jev](https://docs.typesafe.ai)'e devretmesini sağlar. Jev, metin yerine olasılık döndüren bir yargı modelidir: *gerçekten bitti mi? hangi seçenek kurallarımıza uyuyor? bu satıra bakmak gerekir mi?*

Şunlar için kullanabilirsin:
- "bitti" iddialarını gerçek test çıktısıyla karşılaştırmak
- kendi belgelerine dayanarak seçenekler arasında seçim yapmak
- tek bir kuralı, Claude her birini okumadan onlarca öğeye uygulamak

Her çağrı yerelde bir makbuz bırakır.

<p align="center">
  <a href="#hızlı-başlangıç">Hızlı başlangıç</a> ·
  <a href="#nasıl-çalışır">Nasıl çalışır</a> ·
  <a href="#ekonomi">Ekonomi</a> ·
  <a href="#makineden-ne-çıkar">Gizlilik</a> ·
  <a href="MANIFESTO.tr.md">Manifesto</a> ·
  <a href="#sss">SSS</a>
</p>

> [!NOTE]
> **Alfa.** Maliyet rakamları "modellendi" ya da "ölçüldü" diye işaretli. Kendi A/B testimiz ölçmeden hiçbir tasarruf iddia edilmez; aleyhimize çıkan sonuçlar da yayımlanır.

## Neden

Claude Code'daki her ek tur, konuşmanın tamamını yeniden okur. Opus 5.5'te 50 bin token önbellekli bağlamla bu, Claude tek kelime yazmadan yaklaşık 0,01 dolar tutar (liste fiyatlarından modellendi). Bu turların bazıları, yukarıdaki sorular gibi, yalnızca hakemlik işidir.

Jev bu soruları milyon girdi token'ı başına 0,042 dolara yanıtlar. Çıktı ücretsizdir ve TypeSafe'e göre sorguların çoğu yaklaşık 100 ms'de tamamlanır ([How to build with TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md)).

Önemli olan fiyatından çok nasıl çağrıldığı. Maliyet modelimize göre Claude'a önce bir istek dosyası yazdıran gidiş-dönüş, Jev isteğinin kendisinden 100 ila 300 kat pahalı. Bu yüzden claude-referee:

- **Sessiz kalır.** v0.1'deki tek hook oturum brifingidir: en fazla 800 karakter ve yalnızca bunu açan projelerde. v0.2'den itibaren done-gate, doğrulanmamış bir "bitti" iddiası bulmadıkça Claude'un bağlamına hiçbir şey eklemez; bulursa en fazla 300 karakter ekler.
- **Toplu sorar.** Sorular bir *pack*'ten gelir: soruları ve eşikleri tutan JSON dosyaları. Aynı girdiyle ilgili sorular Jev'e tek istekte birlikte gider.
- **Önce kodu dener.** v0.2'den itibaren test koşucusu ve linter çıktısı kodda ayrıştırılır; Jev yalnızca kodun karar veremediği durumları yargılar.
- **Makbuz tutar.** Her çağrı yerelde kaydedilir. v0.1'in eşikleri claude-referee'den önceki kitten geliyor: `done` için 25 etiketli vaka (örnek içi, henüz hold-out yok), `judge` ve `verify` için kitin 0,90'lık otomatik bandı. Eşikleri açıkta yeniden ayarlayacak kayıtlı-cevap eval'leri [yol haritasında](ROADMAP.md).

Bunlar, *Güzel söz değil, kanıt* adlı [manifestodaki](MANIFESTO.tr.md) sekiz kuralın dördü.

## Hızlı başlangıç

Gerekenler:
- Claude Code 2.1.139 ya da sonrası (exec-form hook'lar için). 2.1.285 ile test edildi.
- Claude Code'un gördüğü `PATH`'te Node 20.3 ya da sonrası.
- Bir [TypeSafe API anahtarı](https://docs.typesafe.ai).

**1. Kur**

```bash
claude plugin marketplace add ismaildasci/claude-referee
claude plugin install claude-referee@claude-referee
```

**2. Anahtarını bir kez kaydet.** claude-referee'nin hook'ları da Claude'un çalıştırdığı komutlar da anahtarı burada arar:

```bash
# macOS: Anahtar Zinciri'ne (Keychain) kaydeder; anahtarı sorar, böylece kabuk geçmişine düşmez
security add-generic-password -a "$USER" -s TYPESAFE_API_KEY -w

# Linux (Secret Service, henüz test edilmedi): bir kez kaydet...
secret-tool store --label="TypeSafe API key" service typesafe
# ...sonra bu satırı kabuk profiline ekle ki Claude Code devralsın
export TYPESAFE_API_KEY_CMD="secret-tool lookup service typesafe"
```

<details>
<summary>Windows ve anahtarı vermenin diğer yolları</summary>

- **Windows** henüz test edilmedi. Hook'lar için eklenti ayarını kullan, Claude'un çalıştırdığı komutlar için `TYPESAFE_API_KEY` tanımla.
- **Eklenti ayarı.** `/plugin configure claude-referee` komutunu çalıştırıp `api_key` alanını doldur; Claude Code bunu hassas bir değer olarak saklar. Claude Code eklenti sırlarını kabuğa aktarmadığı için bu değeri yalnızca hook'lar okuyabilir.
- **Ortam değişkeni.** `export TYPESAFE_API_KEY=...`
- **`TYPESAFE_API_KEY_CMD` hakkında.** Yalnızca senin ortamından okunur, hiçbir zaman bir proje dosyasından okunmaz. Kabuk olmadan çalışır, bu yüzden pipe kullanamaz.

claude-referee anahtarı bu sırayla arar:
1. Eklenti ayarı
2. `TYPESAFE_API_KEY`
3. `EVAL_TYPESAFE_API_KEY`
4. `TYPESAFE_API_KEY_CMD`
5. Anahtar Zinciri (Keychain)

</details>

**3. Bir projede aç:** `.claude/referee.json` dosyasını commit'le:

```json
{ "pack": "generic" }
```

Bu dosyanın olmadığı projelerde hook'lar kapalı kalır. v0.2'den itibaren done-gate'i açmak için `hooks.stopGate` değerini `shadow` ya da `active`, önbellek korumasını açmak için `hooks.preModelSwitch` değerini `true` yap. Ayrıntılar [yapılandırma](docs/configuration.md) sayfasında (İngilizce).

**4. Kurulumu denetle:** `npx claude-referee doctor` çalıştır; anahtarı da tek bir ücretsiz API çağrısıyla denetlemek için `doctor --online`. Sonra Claude'a claude-referee brifinginin ne dediğini sor. `doctor` çalışıyor ama Claude brifingi görmüyorsa, Claude Code büyük olasılıkla kendi `PATH`'inde Node'u bulamıyordur. Eklenti ayarında saklanan anahtar hook'lara ulaşır ama kabuğa ulaşmaz; anahtar yalnızca oradaysa `doctor` anahtar bulamadığını bildirir.

### Dene

Brifing yüklendikten sonra Claude bu komutları senin yerine çalıştırır. İstersen kendin de çalıştırabilirsin; ilk `npx` çalıştırması komut satırı aracını indirir.

```bash
# Bitti mi? Kontrol çıktısını doğrudan pipe ile ver; Claude'un okuması gerekmez.
cargo test 2>&1 | npx claude-referee done --criteria "all tests pass" --evidence -

# Seçenekler arasında seç. Bağlam dosyalarını hakem okur; Claude'un yeniden yazması gerekmez.
npx claude-referee decide <<'EOF'
{"decision": "Where should rate-limit counters live?",
 "options": [{"name": "redis",  "text": "Redis, already deployed"},
             {"name": "memory", "text": "In-process LRU on each instance"}],
 "context_files": ["docs/adr/0007-scaling.md"]}
EOF

# Jev'i çağırmadan neyin gönderileceğini gör
cargo test 2>&1 | npx claude-referee done --criteria "all tests pass" --evidence - --dry-run
```

> [!TIP]
> **Kanıtı açık yaz.** Başarıda hiçbir şey basmayan bir kontrol hiçbir şey göstermez. claude-referee geliştirilirken hakem "typecheck geçiyor" ölçütüne `missing` (0,46) dedi, çünkü `tsc` hiç çıktı basmamıştı; çıkış kodu eklenince sonuç `met` (0,97) oldu:
> ```bash
> { npx tsc --noEmit; echo "tsc exit code: $?"; } 2>&1 | npx claude-referee done --criteria "typecheck passes" --evidence -
> ```

Her komut tek satır JSON basar: `ok`, karar, birkaç sayı, varsa bir `next_step` ve bir makbuz kimliği. 1.500 karakteri aşan ayrıntılar bir dosyaya yazılır ve dosyanın yolu JSON'da yer alır. Seçenekler, ölçütler ya da kanıt hiçbir zaman geri basılmaz, çünkü basılan her şey Claude'un bağlamına girer.

Her karar, "bitmedi" dahil, 0 koduyla çıkar; gerçek hatalar 1 koduyla çıkar. CI hattında bu kararlarda 3 koduyla çıkmak için `--fail-on missing,unsure` ekle.

Örneklerdeki ölçütler ve seçenekler bilerek İngilizce: TypeSafe'e göre Jev diğer dilleri İngilizce kadar iyi işlemiyor (bkz. [Ne zaman uygun değil](#ne-zaman-uygun-değil)).

## Neler var

| | Ne yapar | Nasıl çalışır | Sürüm |
|---|---|---|---|
| **`done`** | Bir "bitti" iddiasını, pipe ile verdiğin test ya da lint çıktısıyla karşılaştırır | CLI | v0.1 |
| **`decide`** | 2–6 seçeneği bağlamına göre puanlar. Seçeneklerin sırası Jev'in cevabını oynatabildiği için iki sırayla sorar | CLI | v0.1 |
| **`judge`** | Bir pack'in sorularını çok sayıda öğeye uygular: satırlar, metinler, başarısız testler | CLI | v0.1 |
| **`verify`** | İddiaları bir kaynak metne göre denetler | CLI | v0.1 |
| **Oturum brifingi** | Claude'a hakemi nasıl ucuza çağıracağını en fazla 800 karakterde anlatır | `SessionStart` hook'u, yerel | v0.1 |
| **Makbuzlar** | Çağrı başına model, istek kimliği, token'lar, tahmini maliyet ve gecikme; istek metni yok | Yerel kayıt | v0.1 |
| **`doctor`** | Yapılandırmayı, pack'leri, sürümleri ve anahtarın nereden geldiğini gösterir (anahtarın kendisini asla) | CLI | v0.1 |
| **Done-gate** | Claude dosya düzenledikten sonra geçen bir kontrol olmadan durursa, Jev'e Claude'un doğrulamadığı bir başarıyı iddia edip etmediğini sorar. `shadow` yalnızca kaydeder; `active` Claude'u kontrolü çalıştırmaya geri gönderir | `Stop` hook'u, isteğe bağlı | v0.2 |
| **Önbellek koruması** | Sıcak bir konuşmayı yeniden önbelleğe almanın 0,25 dolar ya da daha fazlasına mal olacağı bir `/model` geçişinden önce sorar | `PreModelSwitch` hook'u, yerel | v0.2 |
| **Pack linter'ı** | Bileşik soruları, eksik `other` seçeneklerini ve çelişen ölçütleri yakalar | CLI, CI | v0.2 |

Deneyler ayrı ve isteğe bağlı bir `claude-referee-labs` eklentisinde durur; ancak kendi ölçümlerini geçince claude-referee'ye taşınır: çıktı budama, Bash komutları için bir onay kapısı, yalnızca aşağı yönlü subagent yönlendirmesi, ilk istemde dosya brifingi, skill önerileri ve test seçimi.

## Nasıl çalışır

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/how-it-works-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/how-it-works-light.svg">
    <img alt="Claude Code oturumundaki olaylar ve CLI çağrıları makinendeki claude-referee'ye gider. Kanıtı kodda ayrıştırır (v0.2'den itibaren), sır içeren istekleri durdurur ve kişisel bilgileri maskeler, bir pack'in sorularını tek istekte toplayıp TypeSafe Jev API'ye gönderir, olasılıklara eşik uygular ve sessizlik, kısa bir not ya da bir JSON kararı döndürür. Makbuzlar ve önbellek yerelde kalır; sorular ve maskelenmiş girdi makineden çıkar." src="assets/how-it-works-light.svg" width="100%">
  </picture>
</p>

1. **Claude Code'da bir şey olur.** Bir oturum başlar ya da Claude bir claude-referee komutu çalıştırır. v0.2'den itibaren iki tetikleyici daha var: Claude durmaya çalışır (done-gate) ya da sen model değiştirirsin (Jev'i hiç çağırmayan önbellek koruması).
2. **Hakem ucuz kısmı kodda yapar.** Sır gibi görünen bir değer içeren isteği durdurur, kişisel bilgileri değiştirir ve pack'ten soruları seçer. v0.2'den itibaren test koşucusu ve linter çıktısını da ayrıştırır. Bu kanıt soruyu çözüyorsa Jev hiç çağrılmaz.
3. **Jev'e tek istek.** İstek, model `jev-1.13.0`'a sabitlenmiş olarak `POST /v1/systemone` adresine gider. Evet/hayır (Noul), birini seç (Choice) ve derecelendirme (Score) soruları olasılık olarak döner.
4. **Kararı eşikler verir.** Hakem ya sessiz kalır, ya kısa bir not ekler ya da bir JSON kararı basar; her durumda bir makbuz yazar.

v0.1'deki oturum hook'u Jev'i hiç çağırmaz. CLI çağrılarının toplam 30 saniyelik bir süre bütçesi vardır (deneme başına 10 saniye, 2 yeniden deneme); zaman aşımı olumsuz bir karar olarak değil `timeout` olarak bildirilir. v0.2'den itibaren Jev'i çağıran hook'lar 2 saniyelik bütçeyle çalışır ve yolu açık bırakır: Jev yavaşsa ya da erişilemiyorsa Claude, claude-referee hiç kurulu değilmiş gibi devam eder.

## Ekonomi

Jev çağrısı işin ucuz kısmı. Para, çağrının etrafındaki Claude turuna gider.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/cost-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/cost-light.svg">
    <img alt="Tek bir yargının Claude tarafındaki maliyetini gösteren çubuk grafik, Opus 5.5 ve 50 bin token önbellekli bağlam için modellendi: bir şey bulamayan hook 0 dolar, 300 karakterlik not ekleyen hook 0,0004 dolar, Haiku prompt hook'u 0,002 dolar, bayraklarla CLI çağrısı 0,012 dolar, decide'ın kullandığı gibi heredoc içinde JSON ile CLI çağrısı en fazla 0,017 dolar, MCP aracı çağrısı 0,017 dolar, istek dosyası yazdıktan sonra CLI çağrısı 0,028 dolar. Jev isteğinin kendisi 0,0001–0,0003 dolar ekler." src="assets/cost-light.svg" width="100%">
  </picture>
</p>

Bundan iki sonuç çıkıyor ve tasarımın tamamını bunlar belirliyor:

1. **Tek bir küçük yargıyı devretmek genellikle zarar ettirir.** Ek bir Claude turu, Claude'un kararı kendisinin vermesinden daha pahalıdır; bu yüzden devretmek ancak toplu işte kazandırır. 80 bin token bağlamda başa baş noktası, öğeler henüz Claude'un bağlamında değilse yaklaşık **23 öğe**, zaten bağlamdaysa yaklaşık **48 öğedir** (modellendi: Opus 5.5, 5 dakikalık önbellek).
2. **En ucuz yargı, Claude'un hiç görmediği yargıdır.** Bir şey bulamayan hook, Claude tarafında hiçbir maliyet yaratmaz. Bir bulgu, kısa bir not kadar tutar.

Grafik 50 bin token bağlam varsayıyor. Bu projeyi kurmadan önce ölçtüğümüz oturumlarda çağrı anındaki bağlamın ortancası 230–470 bin token'dı; yani gerçek bir ek tur birkaç kat daha pahalıya geldi ([ölçümler](docs/measurements.md), İngilizce).

<details>
<summary>Grafiğin arkasındaki rakamlar</summary>

| Yargı Claude'a nasıl ulaşıyor | Ek Claude isteği | Claude çıktı token'ı | Claude tarafındaki maliyet |
|---|---:|---:|---:|
| Hook, bir şey bulunmadı | 0 | 0 | 0 $ |
| Hook 300 karakterlik bir not ekler | 0 | 0 | ≈0,0004 $ |
| Karşılaştırma için Haiku 4.5'te prompt hook'u (2 bin girdi, 50 çıktı) | 0 (ayrı model) | 50 | ≈0,002 $ |
| Yalnızca bayraklarla CLI çağrısı (150 karakterlik komut, 800 karakterlik sonuç) | 1 | ≈40 | ≈0,012 $ |
| `decide`'ın kullandığı gibi heredoc içinde JSON ile CLI çağrısı | 1 | ≈40–300 | ≈0,012–0,017 $ |
| MCP aracı çağrısı (1.200 karakterlik argümanlar, 800 karakterlik sonuç) | 1 | ≈300 | ≈0,017 $, ilk seferde araç araması için ≈0,011 $ daha |
| İstek dosyası yazdıktan sonra CLI çağrısı | 2 | ≈340 | ≈0,028 $ |
| Jev isteğinin kendisi (2–7 bin token) | — | — | ≈0,0001–0,0003 $ |

Bu rakamlar Opus 5.5 ve 50 bin token önbellekli bağlam için modellendi. Maliyet modelinin varsayımları:
- Her ek istek bu bağlamı yeniden okur.
- Claude'un çıktısı çıktı fiyatından faturalanır.
- Sonuç bağlama bir kez girer.
- Sonraki yeniden okumalar hesaba katılmaz.
- Dört karakter bir token sayılır.

Formüller ve başa baş tabloları [docs/economics.md](docs/economics.md) sayfasında (İngilizce). Kendi rakamlarını ölçmek için Claude tarafında Claude Code'daki `/usage` komutunu, Jev tarafında `npx claude-referee receipts --tokens` komutunu kullan.

</details>

## Şimdiye kadar ne ölçüldü

| İddia | Durum | Kaynak |
|---|---|---|
| Jev milyon girdi token'ı başına 0,042 dolar; çıktı ücretsiz | TypeSafe'in belgelerinde | [Jev modelleri](https://docs.typesafe.ai/models.md) |
| Toplu bir yargı 0,0001–0,0003 dolar tutar | 2–7 bin token'lık istekler için modellendi. TypeSafe'in kendi 13 soruluk örneği yaklaşık 0,0005 dolar tuttu | [Cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions.md), senin makbuzların |
| 13 soruyu tek istekte sormak, tek tek sormaktan yaklaşık 12 kat ucuz ve 10 kat hızlı | TypeSafe jev-1.12 üzerinde ölçtü | [Cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions.md) |
| Seçeneklerin sırası Jev'in seçimini değiştirebilir | Özel bir kod tabanında ölçüldü: 4 seçenekli 20 gerçek karar, 24 sıranın hepsiyle soruldu. Bir seçeneğin olasılığı ortalama 0,20, en fazla 0,52 oynadı. Tüm sıraların liderini yazıldığı sıra tek başına 20 kararın 18'inde, yazıldığı sıra ile tersi birlikte 20'sinde buldu | [Ölçümler](docs/measurements.md) (İngilizce) |
| Aynı soruyu yeniden sormak cevabı değiştirir | Pek değil, aynı kod tabanında: tekrarlar cevabı en çok 0,01, taze koşular en çok 0,02 oynattı | [Ölçümler](docs/measurements.md) (İngilizce) |
| claude-referee bir Claude Code görevinin toplam maliyetini düşürür | **Henüz gösterilmedi.** v0.2 A/B testi, ilk çalıştırmadan önce `bench/PREREG.md` içinde önceden kaydedilecek | Sonuç ne olursa olsun yayımlanacak |
| Done-gate doğrulanmamış "bitti" iddialarını yakalar | **Henüz gösterilmedi.** `active` modunun `shadow` yerine önerilmesi için ≥0,8 kesinlik ve ≤%5 yanlış engelleme oranıyla en az 50 etiketlenmiş durma (Stop) kaydı gerekir. Ayrıca Claude Code'un yerleşik `/goal` komutundan (Haiku'nun denetlediği bir durma koşulu) daha fazla yanlış "bitti" iddiasını geçirmemeli ve toplam maliyeti daha düşük olmalı | Etiketlediğin makbuzlar; v0.2 A/B testi |
| Araç çıktısını budamak Claude token'ı kazandırır | Güvenli eşiklerde az. En iyi kalibre edilmiş açık çalışma, büyük çıktı metninin yaklaşık %5'ini gizledi | [winnow](https://github.com/GhalebDweikat/winnow/blob/51d80b945c74c8384bc47fa817179f668289afd8/docs/DESIGN.md) |

Sıra ve tekrar sonuçları `decide`'ı biçimlendirdi: iki sırayla sorar ve Claude'a asla yeniden sormasını söylemez. Budama sonucu, deneylerin kendi ölçümlerini geçene kadar neden `claude-referee-labs`'te kaldığını açıklıyor.

## Makineden ne çıkar

- **TypeSafe'e gider** (`api.typesafe.ai`, ABD'de barındırılıyor). Hiçbir şey gitmeden önce, sır gibi görünen bir değer içeren istek durdurulur; e-posta adresleri, IP adresleri ve ev dizininin yolu değiştirilir; her alanın boyutu sınırlanır. Gidenler:
  - **Her çağrıda:** pack'in soru metni ve sorunun ilgili olduğu girdi.
  - **`done`:** ölçütün ve pipe ile verdiğin çıktı. v0.1'de bu, ham çıktının başı ve sonudur. v0.2'den itibaren, claude-referee'nin kullandığın test koşucusu için bir ayrıştırıcısı varsa ayrıştırılmış başarısız testlerdir.
  - **`decide`:** karar sorusu, satır içi `context`, seçenek metinleri ve `context_files` dosyalarının içeriği.
  - **`judge` ve `verify`:** verdiğin öğeler, iddialar ve kaynak metin.
  - **Done-gate (v0.2), `shadow` modu dahil:** Claude dosya düzenleyip geçen bir kontrol olmadan her durduğunda claude-referee şunları gönderir:
    - isteminin ilk 1.500 karakteri
    - Claude'un son mesajının son 2.000 karakteri
    - kontrol komutları ve geçti/kaldı durumları
    - Claude'un düzenlediği dosyaların yolları

    İstem ve son mesaj serbest metindir; kalıplar serbest metni güvenilir biçimde temizleyemez.
- **Yerelde kalır:** makbuzlar (istek metni içermez) ve cevap önbelleği. API anahtarın yalnızca TypeSafe'e, her istekte kimlik bilgisi olarak gider.
- **Önce denetle:** Jev'i çağıran herhangi bir komuta `--dry-run` eklersen maskelenmiş girdiyi ve token tahminini görürsün; hiçbir şey gönderilmez, önbelleğe alınmaz ya da kaydedilmez. Done-gate'in önizlemesi yoktur.

TypeSafe'in [gizlilik politikası](https://typesafe.ai/legal/privacy-policy) girdinle model eğitmediğini söylüyor; [veri işleme eki](https://typesafe.ai/legal/data-processing) ise sabit bir saklama süresi belirlemiyor. Müşteri verisi gönderme ve önce işvereninin politikasına bak. Maskeleme kuralları ve saklama ayrıntıları [docs/privacy.md](docs/privacy.md) sayfasında (İngilizce).

## Ne zaman uygun değil

- **Kodu, istemleri ya da test çıktısını ABD'de barındırılan bir API'ye gönderemiyorsan.** claude-referee bunların küçük, maskelenmiş parçalarını göndererek çalışır.
- **Oturumların kısa, kontrollerin ucuzsa.** Devretmek toplu işte kazandırır: 80 bin token bağlamda yaklaşık 23 öğeden itibaren (modellendi).
- **İçeriğin çoğunlukla İngilizce değilse.** TypeSafe'e göre Jev diğer dilleri de işler ama İngilizce kadar iyi değil; önce kendi içeriğinde dene.
- **Bir güvenlik sınırına ihtiyacın varsa.** Hakemin kapıları hata durumunda yolu açık bırakır (fail-open) ve kapatılabilir. Kuralları izin kuralları ve branch protection zorunlu kılar.

## Yapılandırma ve pack'ler

claude-referee ayarlarını `/plugin configure claude-referee`'den, commit'lenen `.claude/referee.json` dosyasından, isteğe bağlı `.claude/referee.local.json` dosyasından ve birkaç ortam değişkeninden okur. `REFEREE_HOOKS=off` tüm hook'ları kapatır. Proje dosyaları pack seçebilir ve hook'ları açıp kapatabilir, ama eşikleri yalnızca sıkılaştırabilir ve anahtarı asla belirleyemez.

Sorular ve eşikler kodda değil, pack'lerde durur. `generic` pack'i eklentiyle birlikte gelir. Ekibinin pack'leri özel bir depoda durabilir; böylece claude-referee genel kalırken kuralların gizli kalır. Ayrıntılar [docs/configuration.md](docs/configuration.md) sayfasında (İngilizce).

## SSS

<details>
<summary><b>Bu resmî bir TypeSafe ya da Anthropic projesi mi?</b></summary>

Hayır. Bağımsız bir açık kaynak projesidir; iki şirketle de bağlantılı değildir, onlar tarafından onaylanmamış ya da desteklenmemiştir. Ad, neyle çalıştığını söyler; kimin yaptığını değil. Jev'i kullanan kendi kodunu yazmak için TypeSafe'in resmî eklentisini kullan: `typesafe@typesafe-ai` ([typesafe-ai/skills](https://github.com/typesafe-ai/skills)). claude-referee'nin ona ihtiyacı yoktur.

</details>

<details>
<summary><b>Claude'un muhakemesinin yerine mi geçiyor?</b></summary>

Hayır. Dar sorulara olasılıklarla cevap verir ve eşiklerinin altında kalan durumlarda araya girmez. Son söz Claude'da ve sende kalır. Done-gate varsayılan olarak kapalıdır; onu, yalnızca ne yapacağını kaydettiği `shadow` modunda başlat.

</details>

<details>
<summary><b>İstem önbelleğimi bozar mı?</b></summary>

Hayır. Hook'lar yalnızca kısa notlar ekler; konuşma geçmişini hiçbir şey yeniden yazmaz. Önbellek koruması, oturum ortasında model değiştirmek her şeyi önbelleksiz yeniden okuttuğu için var.

</details>

<details>
<summary><b>TypeSafe yavaşsa ya da çökmüşse ne olur?</b></summary>

v0.1'deki hook Jev'i çağırmaz, bu yüzden oturum hiçbir zaman onu beklemez. Bir CLI çağrısı 30 saniye sonra vazgeçer ve `timeout` bildirir; bu bir "hayır" değil, bilinmeyendir. v0.2'den itibaren Jev'i çağıran hook'lar 2 saniye içinde yolu açık bırakır: kaybettiğin şey oturum değil, yalnızca o kontroldür.

</details>

<details>
<summary><b>Kurulu tutmanın maliyeti ne?</b></summary>

Etkinken claude-referee'nin skill listesi her oturuma en fazla 250 token ekler; `.claude/referee.json` olmayan projelerde bile. Hook'lar, ele aldıkları olaylarda kısa ömürlü bir Node süreci başlatır. `claude plugin details claude-referee` sürekli eklenen token sayısını gösterir.

</details>

<details>
<summary><b>Claude Code olmadan kullanabilir miyim?</b></summary>

Evet. CLI, TypeSafe SDK dahil tek bir paketlenmiş dosyadır. Çalışırken npm'den hiçbir şeye ihtiyaç duymaz; betiklerde ve CI hatlarında da çalışır.

</details>

<details>
<summary><b>Model neden sabitlenmiş?</b></summary>

Eşikler model sürümüne göre ayarlanır; bu yüzden claude-referee varsayılan olarak `jev-1.13.0` kullanır. `TYPESAFE_MODEL` ya da `model` ayarıyla değiştirebilirsin, ama pack'in eşikleri varsayılan model üzerinde ayarlandı. Yeni bir Jev modeline geçmek, eşikleri etiketli vakalar üzerinde yeniden denetlemek demektir; bunu ucuzlatacak eval düzeneği [yol haritasında](ROADMAP.md).

</details>

<details>
<summary><b>Nasıl güncellerim ya da kaldırırım?</b></summary>

- **Güncelleme:** üçüncü taraf marketplace'ler varsayılan olarak kendiliğinden güncellenmez. Önce `claude plugin marketplace update claude-referee`, sonra `claude plugin update claude-referee@claude-referee` çalıştır.
- **Kaldırma:** kaldırmak makbuzları ve önbelleği siler. Silinmesini istemiyorsan `claude plugin uninstall claude-referee@claude-referee --keep-data` çalıştır.
- **Makbuzlarını sakla:** önce `npx claude-referee receipts export --out receipts.jsonl` ile dışa aktar.

</details>

## Yol haritası

| Sürüm | Neler geliyor |
|---|---|
| **v0.1** (bu sürüm) | `done`, `decide`, `judge` ve `verify`; makbuzlar ve `doctor`; maskeleme ve `--dry-run`; oturum brifingi |
| **v0.2** | Kayıtlı-cevap eval'leri ve çevrimdışı eşik taraması; test koşucusu ve linter ayrıştırıcıları; önce `shadow` moduyla done-gate; A/B düzeneği; önbellek koruması ve pack linter'ı |
| **v0.3** | Yerel bir pano: makbuzlar SQLite'ta, tarayıcında gezilir, hiçbir şey yüklenmez |
| **Labs** | [Neler var](#neler-var) bölümünde listelenen deneyler, her biri kendi ölçümünü geçerse |

Ayrıntılar ve yardımın en çok işe yarayacağı yerler [ROADMAP.md](ROADMAP.md) dosyasında (İngilizce).

## Katkı

Anahtara ihtiyacın yok. `npm test`, Jev API'sinin yerel bir taklidine karşı çevrimdışı çalışır ve projenin CI hattı Jev'i hiç çağırmaz. Canlı çalıştırmalar senin anahtarını kullanır.

İlk katkı için iyi konular: koru ve durdur fixture'larıyla maskeleme kalıpları, yeni diller ve alanlar için pack'ler ve v0.2 için test koşucusu ayrıştırıcıları (pytest, `go test`, PHPUnit, RSpec, `dotnet test`). Lütfen müşteri verisini ve gerçek sırları fixture'lara koyma. Ayrıntılar [CONTRIBUTING.md](CONTRIBUTING.md) dosyasında (İngilizce).

## İlgili projeler

Kodlama ajanları için Jev üzerine araç geliştiren diğer projeler:

- [jev-belay](https://github.com/valentynkit/jev-belay): Claude Code için kanıt öncelikli bir Stop kapısı. claude-referee'nin done-gate'i aynı yapıyı izler.
- [claude-jev](https://github.com/buchmark/claude-jev): kod inceleme bulgularını, hata ayıklama hipotezlerini ve tasarım seçeneklerini Jev ile puanlar.
- [kylerhenry/jevgate](https://github.com/kylerhenry/jevgate): Claude Code eklentisi olarak ticket ve teslim kapıları.
- [thevibeworks/jevgate](https://github.com/thevibeworks/jevgate): yalnızca bilinmeyen komutları Jev'e yargılatan bir Bash izin listesi.
- [jevlin](https://github.com/designmon/jevlin): kodlama ajanları için yargı çağrıları ve bir sapma bekçisi.
- [winnow](https://github.com/GhalebDweikat/winnow): araç çıktısı için çöp toplama; ölçümleri tasarım notlarında yayımlanmış.

## Lisans

MIT. claude-referee; Anthropic ya da TypeSafe ile bağlantılı değildir, onlar tarafından onaylanmamış ya da desteklenmemiştir. "Claude" ve "Claude Code", Anthropic, PBC'nin markalarıdır. "TypeSafe" ve "Jev" sahiplerinin markalarıdır. Burada yalnızca claude-referee'nin neyle çalıştığını belirtmek için anılırlar.
