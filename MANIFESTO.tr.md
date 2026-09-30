# Güzel söz değil, kanıt

*claude-referee manifestosu*

Kodlama ajanları iyi yazar. "Tüm testler geçti. Bitti." akıcı tek bir satırdır ve yazması hiçbir şeye mal olmaz. Doğrulaması bir test koşusuna mal olur; yanlışsa biri bunu sonra fark eder.

claude-referee küçük bir bahis. Bir ajanın oturum içinde verdiği kararların çoğu dar ve denetlenebilir sorulardır: gerçekten bitti mi, hangi seçenek kurallarımıza uyuyor, bu satıra bakmak gerekir mi? Yargı için yapılmış, düz yazı yerine olasılık döndüren bir model bu kararları büyük modelin üstünden alabilir; ucuza ve makbuzuyla.

Bu bir bahis, henüz bir sonuç değil. Sonucu öğrenene kadar kendimize koyduğumuz kurallar şunlar.

## 1. Kanıt yoksa "bitti" de yok

Düz yazıyla verilmiş bir başarı iddiası kanıt değildir; test çıktısı kanıttır. Hakem, ajanın kontroller hakkında ne dediğine değil, kontrollerin ne bastığına bakar.

## 2. Varsayılan sessizliktir

En ucuz yargı, ajanın hiç görmediği yargıdır. Bir kontrol bir şey bulamazsa bağlama hiçbir şey eklemez. Bir şey bulursa bunu en fazla 300 karakterle söyler.

## 3. Önce kod, sonra model

Bir soruyu ayrıştırıcı çözebiliyorsa hiçbir modele sorulmaz. Jev yalnızca kodun karar veremediğini, Claude da yalnızca Jev'in karar veremediğini yargılar.

## 4. Çağrıları değil turları say

Bir Jev isteği bir sentin çok küçük bir kesrine mal olur. Etrafındaki Claude turu ise bütün konuşmayı yeniden okur ve çok daha pahalıdır. Bu yüzden sorular toplu gider, cevaplar kısa döner ve hakem, eklediği ya da kazandırdığı Claude turlarıyla ölçülür.

## 5. Yeniden sorma, daha iyi sor

Aynı soruyu Jev'e iki kez sormak cevabı yaklaşık 0,01 oynatır. Seçeneklerin sırasını değiştirmek ise testlerimizde bir seçeneği 0,52'ye kadar oynattı. Bu yüzden bir seçim iki sırayla sorulur ve beraberlik, soruyu yeniden sorarak değil eksik olguyu ekleyerek çözülür.

## 6. En azını gönder

Makineden yalnızca bir yargının ihtiyaç duyduğu şey çıkar. Sır gibi görünen bir değer isteği durdurur, kişisel bilgiler değiştirilir ve `--dry-run` isteği gitmeden önce gösterir. Kalıplar serbest metni temizleyemez; bu yüzden serbest metin gönderen parçalar siz açana kadar kapalı kalır.

## 7. Makbuz yoksa olmamıştır

Her çağrı yerelde bir makbuz bırakır: model, token, maliyet ve süre; istek metni asla. Önceden kaydedilmiş bir A/B testi göstermeden tasarruf iddia etmeyiz; aleyhimize çıkan sonuçları da yayımlarız. Bu depodaki her sayı "modellendi" ya da "ölçüldü" diye işaretlidir.

## 8. Hakemin kararı itiraza açıktır

Dar sorulara olasılıklarla cevap verir ve eşiklerinin altında kalan durumlarda araya girmez. Son söz ajanda ve sizdedir. Hata durumunda yolu açık bırakır, kapatılabilir ve bir güvenlik sınırı değildir.

---

Büyük kararları Claude verir. Küçük kararları hakem verir ve gerekçesini gösterir.

*4. ve 5. kuralın arkasındaki ölçümler [docs/measurements.md](docs/measurements.md) sayfasında (İngilizce). claude-referee bağımsız bir projedir; Anthropic ya da TypeSafe ile bağlantısı yoktur.*
