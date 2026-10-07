using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using RiffGame;
using RiffGame.Interop;
using RiffGame.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

builder.Services.AddSingleton<AudioInterop>();
builder.Services.AddSingleton<DownloadInterop>();
builder.Services.AddSingleton<StorageInterop>();
builder.Services.AddSingleton<SongLibrary>();
builder.Services.AddSingleton<ChartLibrary>();
builder.Services.AddSingleton<LibraryAuth>();

await builder.Build().RunAsync();
