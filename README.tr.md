<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.gif">
    <img alt="claude-referee: güzel söz değil, kanıt. Claude tüm testlerin geçtiğini söylüyor; hakemin done-gate'i (v0.2) son düzenlemeden beri hiçbir kontrolün geçmediğini söyleyip Claude'dan cargo nextest çalıştırmasını istiyor ve 2 hata çıkıyor." src="assets/hero-light.gif" width="100%">
  </picture>
</p>

<p align="center">
  "Bitti" iddialarını ve küçük karar anlarını TypeSafe Jev ile denetleyen, her çağrının makbuzunu tutan, resmî olmayan bir Claude Code eklentisi.
</p>

<p align="center">
  <a href="#kurulum">Kurulum</a> ·
  <a href="#nasıl-çalışır">Nasıl çalışır</a> ·
  <a href="#şimdiye-kadar-ne-ölçüldü">Ne ölçüldü</a> ·
  <a href="#maliyeti-ne">Maliyeti ne</a> ·
  <a href="MANIFESTO.tr.md">Manifesto</a> ·
  <a href="docs/measurements.md">Ölçümler</a> ·
  <a href="README.md">English</a>
</p>

---

Kodlama ajanları iyi yazar. "Tüm testler geçti. Bitti." akıcı tek bir cümledir ve yazmak hiçbir şeye mal olmaz. Onu doğrulamak bir test koşusu ister; cümle yanlışsa birileri bunu sonradan fark eder.

claude-referee, bu tür cümleleri denetleyen, resmî olmayan bir Claude Code eklentisidir. Büyük kararları yine Claude verir. *Gerçekten bitti mi?* ya da *bu seçeneklerden hangisi kurallarımıza uyuyor?* gibi küçük ve denetlenebilir sorular Jev'e gider: TypeSafe'in, paragraf yerine "0,97 evet" gibi bir olasılıkla cevap veren modeli. Her kontrol makinende kayda geçer.

## Ne yapar

| Ne zaman | Ne olur | Sürüm |
|---|---|---|
| **Sen ya da Claude bir komut çalıştırınca** | `done`, `decide`, `judge` ya da `verify` Jev'e sorar ve tek satırlık bir cevap basar | v0.1 |
| **Oturum başlayınca** | Claude'a komutları nasıl kullanacağını anlatan, en fazla 800 karakterlik kısa bir not gider | v0.1 |
| **Claude durunca** | Varsayılan olarak kapalı. `active` modda Jev, Claude'un "bitti" iddiasını doğrulanmamış bulursa durma engellenir ve Claude koşması gereken kontrolü söyleyen bir not alır; oturum başına en fazla üç kez. Jev yavaşsa ya da çalışmıyorsa hook yolu açık bırakır | v0.2 |
| **Model değiştirince** | Claude'un tüm konuşmayı tam fiyatla yeniden okumasına yol açacak bir geçişten önce uyarı | v0.2 |

Bir kontrol hiçbir şey bulmazsa Claude hiçbir şey görmez. Bir şey bulursa Claude en fazla 300 karakterlik bir not görür.

Neden yalnızca bir komut değil? claude-referee'den önceki kitte Claude `done` kontrolünü istediği zaman çalıştırabiliyordu ve 14 günde bir kez çalıştırdı. Kendiliğinden çalışmayan bir kontrol neredeyse yok hükmündedir. Bu yüzden v0.2, Claude her durduğunda çalışan bir kontrol ekliyor.

## Nasıl çalışır

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/how-it-works-dark.gif">
  <img alt="Claude Code, hook olaylarını ve CLI çağrılarını makinendeki claude-referee'ye gönderir. claude-referee kanıtı kodda ayrıştırır, sırları durdurur, kişisel veriyi maskeler ve soruları tek bir istekte TypeSafe Jev API'sine gönderir. Jev olasılık döndürür; hakem bunları eşiklerle sessizliğe, kısa bir nota ya da JSON karara çevirir." src="assets/how-it-works-light.gif" width="100%">
</picture>

1. Claude Code'da bir şey olur: bir oturum başlar ya da Claude komutlardan birini çalıştırır.
2. claude-referee makinende çalışır. Parola ya da anahtara benzeyen her şeyi durdurur, e-posta ve IP adreslerini değiştirir ve soruyu küçük tek bir isteğe dönüştürür.
3. Jev olasılıklarla cevap verir.
4. claude-referee bunları sabit eşiklerle karşılaştırır. Ya sessiz kalır, ya kısa bir not ekler ya da tek satırlık bir JSON sonuç basar.

Düz kod bir soruyu cevaplayabiliyorsa hiçbir modele sorulmaz. Diyagram tasarımın tamamını gösteriyor: v0.1'de oturum notu ve dört komut çalışıyor; durunca yapılan kontrol, model değişimi uyarısı ve test çıktısının kodda okunması v0.2'de geliyor ([yol haritası](ROADMAP.md)).

## Şimdiye kadar ne ölçüldü

Kısacası: seçeneklerin sırası Jev'in cevabını, soruyu yeniden sormaktan çok daha fazla değiştiriyor; bir kontrolün asıl maliyeti de Jev'in değil, Claude'un zamanı.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/status-board-dark.png">
  <img alt="Durum panosu. Ölçülen: seçenek sırası Jev'in seçimini oynatıyor (0,52'ye kadar); yeniden sormak neredeyse oynatmıyor (0,01); iki sıra 24 sıranın tamamıyla eşleşiyor (20/20); brifing 600 karaktere sığıyor. Modellenen: tek küçük bir yargı genellikle para kaybettirir; toplu sorular 80K bağlamda yaklaşık 23 öğede başa baş gelir. Henüz gösterilmeyen: görev başına daha düşük toplam maliyet; 50 etiketli durdurmada done-gate kesinliği; done kontrolünün hold-out doğruluğu." src="assets/charts/status-board-light.png" width="100%">
</picture>

Buradaki sayıların çoğu tek bir özel kod tabanından, tek ekipten ve tek yazardan geliyor: claude-referee'den önceki kit, Eylül 2026. Onları genel sonuç değil, erken işaret olarak okuyun. 2026-09-30 ve 2026-10-01 tarihli satırlar ise claude-referee'nin kendisiyle, ham sonuçları bu depoda olan açık girdilerle ölçüldü. Her birinin nasıl ölçüldüğü [docs/measurements.md](docs/measurements.md) sayfasında (İngilizce).

### Seçenek sırası cevabı oynatıyor. Yeniden sormak oynatmıyor.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/order-vs-retry-dark.png">
  <img alt="0 ile 0,6 arası yatay çubuklar. Aynı istek yeniden: en fazla 0,01. Önbellek atlanarak taze koşu: en fazla 0,02. Seçeneklerin sırası değişince: ortalama 0,20, en fazla 0,52. Tek bir özel kod tabanından 20 gerçek, 4 seçenekli karar; her biri 24 sırayla." src="assets/charts/order-vs-retry-light.png" width="100%">
</picture>

Önceki kitte aynı seçenekler farklı sırayla yazılınca Jev'in bir seçeneğe verdiği olasılık 0,52'ye kadar değişti. Aynı soruyu birebir yeniden sormak ise en fazla 0,01 değiştirdi. Bu yüzden `decide` her seçimi iki kez sorar, bir kez senin sıranla, bir kez ters sırayla, ve ikisinin ortalamasını alır. Claude'a asla "yeniden sor" demez: beraberlik, eksik olgu eklenerek çözülür. claude-referee'nin 19'unda liderin 0,9 ya da üstünde olduğu 20 kararlık kendi açık setinde sıra en fazla 0,13, yeniden sormak en fazla 0,04 değiştirdi. Önceden kayda geçirilmiş 39 yakın kararlık sette ise sıra olasılığı ortalama 0,26, en fazla 0,42 değiştirdi; ters sıra, yazılan sırayı iki kez sormaktan daha çok 24 sıranın ortalamasına yaklaştırdı.

### İki sıra yeterli

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/policies-compare-dark.png">
  <img alt="Beş sıralama politikası, karar başına Jev isteği ve 20 kararın kaçında tüm sıraların lideriyle eşleştiğine göre. Yalnızca yazıldığı sıra: 1 istek, 20'de 18. Yazıldığı sıra ve tersi: 2 istek, 20'de 20. Dört dönüş: 4 istek, 20'de 19. İki sıra, emin değilse 24'ü: ortalama 10,8 istek, 20'de 20. 24 sıranın tamamı: 24 istek, referans." src="assets/charts/policies-compare-light.png" width="100%">
</picture>

Senin sıran ve tersiyle sormak, 24 sıranın hepsini denemekle aynı kazananı 20 kararın 20'sinde buldu; 24 yerine 2 istekle.

### Fatura Jev'de değil, Claude turunda

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/claude-turn-cost-dark.png">
  <img alt="Karar başına Jev maliyeti: 0,0007 dolar. CLI çağrısı başına Claude tarafı maliyeti: liste fiyatlarından tahminen 0,10 dolar. 321 CLI çağrısı, çağrı anında ortanca bağlam 230 ile 470 bin token, çağrıların yüzde 37'si alt ajanlardan." src="assets/charts/claude-turn-cost-light.png" width="100%">
</picture>

Bir Jev kararı yaklaşık 0,0007 dolar tuttu. Etrafındaki Claude turu ise liste fiyatlarından tahminen 0,10 dolar tuttu, çünkü her ek tur Claude'a tüm konuşmayı yeniden okutur. Bu yüzden hakem bir şey bulmadıkça sessiz kalır, soruları tek istekte toplar ve kısa cevap verir. Soruları toplamak Jev tarafında da tasarruf sağlıyor; TypeSafe'in ölçümü:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/typesafe-batching-dark.png">
  <img alt="Soruları toplu göndermek, TypeSafe'in jev-1.12 üzerindeki ölçümü: tek istekte 13 soru 0,000497 dolar ve 0,27 saniye; 13 ayrı istek 0,00609 dolar ve 2,71 saniye. 12,2 kat ucuz, 10,0 kat hızlı." src="assets/charts/typesafe-batching-light.png" width="100%">
</picture>

Bütün ölçümler tek tabloda:

| Ne zaman | Ne | Sonuç | Tür · kapsam |
|---|---|---|---|
| 2026-09 | Seçenek sırası ve yeniden sormak | 0,52'ye kadar, en fazla 0,01'e karşı | Ölçüldü · önceki kit, 20 karar, tek kod tabanı |
| 2026-09 | İki sıra ve 24 sıranın tamamı | 20'de 20 aynı lider | Ölçüldü · aynı 20 karar |
| 2026-09 | Claude turu ve Jev kararı | yaklaşık 0,10 dolar (tahmin), yaklaşık 0,0007 dolara karşı | Ölçüldü, maliyet tahmin · 321 CLI çağrısı |
| 2026-09 | SessionStart brifing boyutu | 431–599 karakter (hedef 600) | Ölçüldü · tek çalışma alanının dört bölgesi |
| 2026-09 | Aynı denetim, ikinci koşu | 0 Jev isteği (ilk koşu: 10) | Ölçüldü · 10 çiftlik tek denetim |
| 2026-09 | Gönüllü `done` komutu | 14 günde 1 koşu | Ölçüldü · 14 gün, tek kod tabanı |
| 2026-09-30 | API sınırları, canlı yoklama | 11 Score seviyesi ve 256 seçenek 400 alıyor; 1 seviyeli Score kabul ediliyor | Ölçüldü · claude-referee, 7 istek |
| 2026-09-30 | Gecikme, p50 | 275–379 ms; 2,4 saniye boyunca saniyede yaklaşık 179 bin token'da 429 yok | Ölçüldü · claude-referee, 182 istek, tek makine |
| 2026-09-30 | Seçenek sırası ve yeniden sormak | 0,13'e kadar ve 0,04'e kadar | Ölçüldü · claude-referee, 20 açık karar |
| 2026-09-30 | İki sıra ve 24 sıranın tamamı | 20'de 20 aynı lider; diğer bütün politikalar da | Ölçüldü · aynı 20 açık karar |
| 2026-10-01 | Bir iddia kontrolü olarak `decide` | doğru iddialarda supports 0,97–1,00; 15 yanlışın 13'ünde 0,00–0,23 | Ölçüldü · bu deponun belgeleri hakkında 31 iddia |
| 2026-10-01 | "Kanıtı veri olarak ele al" notu | hiçbir karar değişmedi; benimsenmedi | Ölçüldü · 33 enjeksiyon logu |

Diğer grafikler (kalibrasyon, seçenek başına sorular, sır kuralının ayarı, brifing boyutu) [docs/measurements.md](docs/measurements.md) sayfasında.

## Maliyeti ne

Kısacası: tek bir küçük kontrol genellikle Claude tarafında kazandırdığından fazlasına mal olur. Kontroller, birçok öğe bir arada denetlendiğinde kazandırır.

**Henüz iddia edilmeyen:** claude-referee'nin bir Claude Code görevini toplamda ucuzlattığı. Bunun için, planı çalıştırılmadan önce yayımlanan ve eklentili ve eklentisiz oturumları karşılaştıran bir test gerekiyor. Sonuç ne olursa olsun yayımlanacak.

Grafik, bir kontrolün cevabı Claude'a nasıl ulaştığına göre Claude tarafında ne kadar tuttuğunu gösteriyor. Bunlar Opus 5.5 ve 50 bin token'lık konuşma için yapılmış tahminler, ölçüm değil.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/cost-dark.png">
  <img alt="Tek bir yargının Claude tarafındaki maliyeti. Varsayılan yollar: sessiz hook 0 dolar, 300 karakterlik not 0,0004 dolar, yalnızca bayraklı CLI 0,012 dolar, heredoc ile JSON 0,017 dolara kadar. Diğer yollar: Haiku prompt hook'u 0,002 dolar, MCP araç çağrısı 0,017 dolar, istek dosyası 0,028 dolar. Opus 5.5 ve 50 bin token'lık önbellekli bağlam için modellendi. Ölçülmedi." src="assets/cost-light.png" width="100%">
</picture>

Gerçek oturumlar 50 bin token'dan çok daha uzundu:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/context-size-dark.png">
  <img alt="0 ile 500 bin arası token ekseni. Maliyet grafiği 50 bin varsayıyor (modellendi). Çağrı anında ölçülen ortanca 230 ile 470 bin arasındaydı; tek bir özel kod tabanından 321 CLI çağrısı." src="assets/charts/context-size-light.png" width="100%">
</picture>

Peki kararı Claude'a bırakmak yerine Jev'e sormak ne zaman değer? Bu tahmine göre yalnızca birçok öğe bir arada denetlendiğinde: 80 bin token'lık bir konuşmada yaklaşık 23 öğeden itibaren.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/break-even-dark.png">
  <img alt="Başa baş için gereken öğe sayısı, liste fiyatlarından modellendi: 80 bin bağlamda öğeler bağlamda değilse 23, zaten bağlamdaysa 48, 2.000 token'lık uzun sonuçta 37; 150 bin bağlamda öğeler bağlamda değilse 34, zaten bağlamdaysa 71. Ölçülmedi." src="assets/charts/break-even-light.png" width="100%">
</picture>

Aynı soruyu yeniden sormak bedava: cevaplar makinende önbelleğe alınır.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/cache-rerun-dark.png">
  <img alt="10 çiftlik tek bir denetim: ilk koşu 7.316 girdi token'ıyla 10 Jev isteği yaptı; aynı denetim yeniden 0 istek yaptı; --fresh ile yeniden 10 istek yaptı." src="assets/charts/cache-rerun-light.png" width="100%">
</picture>

Kendi rakamlarını görmek için Claude tarafında Claude Code'daki `/usage` komutunu, Jev tarafında şunu kullan:

```sh
npx claude-referee receipts --tokens
```

## Kurulum

> [!WARNING]
> **Henüz npm'de değil.** npm paketi yayımlanana kadar (Ekim başı) `npx claude-referee` 404 hatası verir. Claude etkilenmez: eklenti kendi içindeki kopyayı çalıştırır. Bu sayfadaki komutları kendin çalıştırmak için bu alias'ı ekle ve belgelerde `npx claude-referee` geçen her yerde `claude-referee` yaz:
> ```sh
> alias claude-referee='npx --yes --package https://github.com/ismaildasci/claude-referee/releases/download/v0.1.3/claude-referee-0.1.3.tgz claude-referee'
> ```

Gerekenler: Claude Code 2.1.139 ya da sonrası (2.1.285 ile test edildi), Claude Code'un gördüğü `PATH` üzerinde Node 20.3 ya da sonrası ve bir [TypeSafe API anahtarı](https://docs.typesafe.ai).

**1. Eklentiyi kur**

```sh
claude plugin marketplace add ismaildasci/claude-referee
claude plugin install claude-referee@claude-referee
```

**2. Anahtarını bir kez sakla.** Claude'un çalıştırdığı komutlar da hakemin hook'ları da onu burada arar:

```sh
# macOS: Keychain'e kaydeder ve anahtarı sorar; böylece anahtar kabuk geçmişine girmez
security add-generic-password -a "$USER" -s TYPESAFE_API_KEY -w

# Linux (henüz test edilmedi): Secret Service'e kaydet, sonra kabuk profilinden claude-referee'yi ona yönlendir
secret-tool store --label="TypeSafe API key" service typesafe
export TYPESAFE_API_KEY_CMD="secret-tool lookup service typesafe"
```

Ya da `TYPESAFE_API_KEY` tanımla. `/plugin configure claude-referee` de anahtarı saklar, ama Claude Code eklenti sırlarını yalnızca hook'lara iletir, kabuğa iletmez. Tam arama sırası [yapılandırma](docs/configuration.md#the-api-key) sayfasında (İngilizce).

**3. Bir projede aç:** `.claude/referee.json` dosyasını commit'le. Bu dosya yoksa hakem sessiz kalır:

```json
{ "pack": "generic", "areas": [{ "prefix": "", "checks": ["npm test"] }] }
```

**4. Kurulumu denetle:**

```sh
npx claude-referee doctor            # anahtarı tek bir ücretsiz çağrıyla denetlemek için --online ekle
```

`doctor` çalışıyor ama Claude brifingi görmüyorsa Claude Code büyük olasılıkla `PATH` üzerinde Node'u bulamıyordur. Windows henüz test edilmedi.

### Dene

```sh
# Bitti mi? Kontrol çıktısını doğrudan boruyla ver; Claude'un okumasına gerek kalmaz.
npm test 2>&1 | npx claude-referee done --criteria "all tests pass" --evidence -

# Tek bir evet/hayır kuralını birçok öğeye uygula: burada bir diff'in eklenen her satırı.
git diff -U0 --no-ext-diff | grep '^+[^+]' | npx claude-referee judge --question line.risky --items -

# Seçenekler arasında seç. Bağlam dosyalarını hakem kendisi okur.
npx claude-referee decide <<'EOF'
{"decision": "Where should rate-limit counters live?",
 "options": [{"name": "redis", "text": "Redis, already deployed"},
             {"name": "memory", "text": "In-process LRU on each instance"}],
 "context_files": ["docs/adr/0007-scaling.md"]}
EOF

# Jev'i çağırmadan neyin gönderileceğini gör
npm test 2>&1 | npx claude-referee done --criteria "all tests pass" --evidence - --dry-run
```

Her komut tek satır JSON basar: `ok`, karar, birkaç sayı, varsa bir `next_step` ve bir makbuz kimliği. "Bitmedi" dahil her karar 0 ile çıkar; CI'da `--fail-on missing,unsure` bu kararlarda 3 ile çıkar. `--describe` her komutun tam sözleşmesini basar.

> [!TIP]
> **Kanıtı açık yaz.** Başarıda hiçbir şey basmayan bir kontrol hiçbir şey göstermez. claude-referee geliştirilirken hakem "typecheck geçiyor" ölçütüne `missing` (0,46) dedi, çünkü `tsc` hiç çıktı basmamıştı; çıkış kodu eklenince sonuç `met` (0,97) oldu. (Bir kez ölçüldü, 2026-09-30.)
> ```sh
> { npx tsc --noEmit; echo "tsc exit code: $?"; } 2>&1 | npx claude-referee done --criteria "typecheck passes" --evidence -
> ```

`done`, yalnızca bir test çalıştırıcısının, linter'ın ya da tip denetleyicisinin özetini ya da bir çıkış kodu satırını tanırsa `met` döndürür. Başka her şey `trust: unparsed` ile `unsure` olarak gelir. Kanıtta sıfırdan farklı bir çıkış kodu varsa sonuç `missing` olur (`reason: exit_code_nonzero`) ve Jev'e sorulmaz.

## Makinenden ne çıkar

- TypeSafe'in ABD'de çalışan API'sine yalnızca bir kontrolün ihtiyaç duyduğu kadarı gönderilir.
- Girdide parola, anahtar ya da token'a benzeyen bir şey varsa hiçbir şey gönderilmez.
- E-postalar, IP adresleri ve ev klasörünün yolu gönderilmeden önce değiştirilir.
- `--dry-run`, neyin gönderileceğini göndermeden birebir gösterir.
- Kayıt makinende kalır: model, token, maliyet ve süre; gönderdiğin metin asla.
- Kendiliğinden serbest metin gönderecek her şey sen açana kadar kapalı kalır.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/charts/redaction-dark.png">
  <img alt="Maskeleme kurallarının tek bir özel kod tabanındaki 12.166 Bash çıktısını taramasında yakaladıkları: 3'ü kimlik bilgisine benziyordu ve bir isteği durdururdu. 2.048 değer değiştirildi: 1.490 UUID, 190 IP adresi, 190 başka tanımlayıcı, 178 e-posta. En yavaş çıktı: 14 ms. Değiştirmeler elle gözden geçirilmedi." src="assets/charts/redaction-light.png" width="100%">
</picture>

Ayrıntılar: [makinenden ne çıkar](docs/privacy.md) (İngilizce).

## Kurallar

1. **Kanıt yoksa "bitti" de yok.** Test çıktısı kanıttır; testlerin geçtiğini söyleyen bir cümle değildir.
2. **Varsayılan sessizliktir.** Hiçbir şey bulmayan bir kontrol Claude'un bağlamına hiçbir şey eklemez.
3. **Önce kod, sonra model.** Düz kod cevaplayabiliyorsa hiçbir modele sorulmaz.
4. **Çağrıları değil turları say.** Ek bir Claude turu, bir Jev çağrısından çok daha pahalıdır.
5. **Yeniden değil, daha iyi sor.** Soruyu tekrarlamak yerine eksik olguyu ekle.
6. **En azını gönder.** Makinenden yalnızca bir kontrolün ihtiyaç duyduğu kadarı çıkar.
7. **Makbuz yoksa olmamıştır.** Her çağrı kayda geçer; ölçülmeden hiçbir tasarruf iddia edilmez.
8. **Hakemin kararı itiraza açıktır.** Son söz sende ve Claude'dadır.

Her birinin gerekçesi [MANIFESTO.tr.md](MANIFESTO.tr.md) dosyasında.

## Daha fazlası

Belgeler İngilizce:
- [Yapılandırma](docs/configuration.md): ayarlar, proje dosyası, pack'ler ve anahtar arama sırası
- [Makinenden ne çıkar](docs/privacy.md) ve [ekonomi](docs/economics.md)
- [Ölçümler](docs/measurements.md): yukarıdaki her sayı, yöntemi ve sınırlarıyla
- [SSS](docs/faq.md), [yol haritası](ROADMAP.md) ve [değişiklik günlüğü](CHANGELOG.md)
- [Katkı](CONTRIBUTING.md): API anahtarı gerekmez, testler çevrimdışı çalışır. Güvenlik bildirimleri: [SECURITY.md](SECURITY.md)
- Kendi TypeSafe kodunu mu yazıyorsun? TypeSafe'in resmî eklentisi Claude'a API'nin tüm bağlamını verir: `claude plugin marketplace add typesafe-ai/skills`, ardından `claude plugin install typesafe@typesafe-ai`. claude-referee'nin buna ihtiyacı yok.

---

<sub>claude-referee bağımsız, resmî olmayan bir projedir; Anthropic ya da TypeSafe ile bağlantılı değildir ve onlar tarafından onaylanmamıştır. Hata durumunda yolu açık bırakır, kapatılabilir ve bir güvenlik sınırı değildir. MIT lisanslıdır. "Claude" ve "Claude Code" Anthropic, PBC'nin ticari markalarıdır; "TypeSafe" ve "Jev" sahiplerinin ticari markalarıdır ve burada yalnızca claude-referee'nin neyle çalıştığını söylemek için kullanılır.</sub>
